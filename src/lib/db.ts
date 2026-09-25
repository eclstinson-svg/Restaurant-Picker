import { supabase } from "./supabase";
import type { RestaurantDetails } from "./types";

// Everything that reads or writes the shared database lives here.
// Tables are defined in supabase/schema.sql.

export type Member = { user_id: string; display_name: string };

export type Couple = { id: string; invite_code: string; members: Member[] };

// The restaurant info we store with a visit / wishlist entry.
export type PlaceInfo = {
  place_id: string;
  name: string;
  address: string | null;
  cuisine_label: string | null;
  price: number | null;
  maps_url: string | null;
};

export type SavedPlace = PlaceInfo & {
  id: string;
  wishlist: boolean;
  blocked: boolean;
  visitCount: number;
};

export type Rating = { visit_id: string; user_id: string; stars: number; note: string | null };

export type Visit = {
  id: string;
  visited_on: string; // "2026-09-25"
  place: SavedPlace;
  ratings: Rating[];
};

function db() {
  if (!supabase) throw new Error("Supabase isn't configured.");
  return supabase;
}

// Supabase errors from our SQL functions carry our own readable message.
function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// Same, for queries that must return a row.
function required<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  const data = check(result);
  if (data === null || data === undefined) throw new Error("Not found.");
  return data;
}

export function placeInfoFrom(p: RestaurantDetails): PlaceInfo {
  return {
    place_id: p.id,
    name: p.name,
    address: p.address || null,
    cuisine_label: p.cuisineLabel ?? null,
    price: p.price ?? null,
    maps_url: p.googleMapsUrl,
  };
}

// ─── Couple ─────────────────────────────────────────────────────────────

export async function getMyCouple(userId: string): Promise<Couple | null> {
  const membership = check(
    await db().from("couple_members").select("couple_id").eq("user_id", userId).maybeSingle(),
  );
  if (!membership) return null;
  const couple = required(
    await db()
      .from("couples")
      .select("id, invite_code, couple_members(user_id, display_name)")
      .eq("id", membership.couple_id)
      .single(),
  );
  return {
    id: couple.id,
    invite_code: couple.invite_code,
    members: couple.couple_members as Member[],
  };
}

export async function createCouple(myName: string) {
  check(await db().rpc("create_couple", { my_name: myName }));
}

export async function joinCouple(code: string, myName: string) {
  check(await db().rpc("join_couple", { code, my_name: myName }));
}

// ─── Saved places (wishlist / hidden / visited) ─────────────────────────

type SavedRow = Omit<SavedPlace, "visitCount"> & { visits: { count: number }[] };

function toSaved(row: SavedRow): SavedPlace {
  const { visits, ...rest } = row;
  return { ...rest, visitCount: visits?.[0]?.count ?? 0 };
}

const SAVED_COLUMNS =
  "id, place_id, name, address, cuisine_label, price, maps_url, wishlist, blocked, visits(count)";

export async function listSaved(coupleId: string): Promise<SavedPlace[]> {
  const rows = check(
    await db()
      .from("saved_places")
      .select(SAVED_COLUMNS)
      .eq("couple_id", coupleId)
      .order("created_at", { ascending: false }),
  );
  return (rows as SavedRow[]).map(toSaved);
}

// Creates the saved place if it's new, and applies any flag changes.
export async function savePlace(
  coupleId: string,
  place: PlaceInfo,
  flags: Partial<Pick<SavedPlace, "wishlist" | "blocked">> = {},
): Promise<string> {
  // Copy only the columns we store (callers may pass a bigger object).
  const { place_id, name, address, cuisine_label, price, maps_url } = place;
  const row = required(
    await db()
      .from("saved_places")
      .upsert(
        { couple_id: coupleId, place_id, name, address, cuisine_label, price, maps_url, ...flags },
        { onConflict: "couple_id,place_id" },
      )
      .select("id")
      .single(),
  );
  return row.id;
}

export async function setFlags(
  savedPlaceId: string,
  flags: Partial<Pick<SavedPlace, "wishlist" | "blocked">>,
) {
  check(await db().from("saved_places").update(flags).eq("id", savedPlaceId));
}

// ─── Visits and ratings ─────────────────────────────────────────────────

export async function logVisit(
  coupleId: string,
  place: PlaceInfo,
  visitedOn: string,
  userId: string,
  stars: number,
  note: string,
) {
  // Going somewhere takes it off the wishlist.
  const savedPlaceId = await savePlace(coupleId, place, { wishlist: false });
  const visit = required(
    await db()
      .from("visits")
      .insert({ couple_id: coupleId, saved_place_id: savedPlaceId, visited_on: visitedOn })
      .select("id")
      .single(),
  );
  await rateVisit(visit.id, userId, stars, note);
}

export async function rateVisit(visitId: string, userId: string, stars: number, note: string) {
  check(
    await db()
      .from("visit_ratings")
      .upsert(
        { visit_id: visitId, user_id: userId, stars, note: note.trim() || null },
        { onConflict: "visit_id,user_id" },
      ),
  );
}

export async function listVisits(coupleId: string): Promise<Visit[]> {
  const rows = check(
    await db()
      .from("visits")
      .select(`id, visited_on, saved_places(${SAVED_COLUMNS}), visit_ratings(visit_id, user_id, stars, note)`)
      .eq("couple_id", coupleId)
      .order("visited_on", { ascending: false })
      .order("created_at", { ascending: false }),
  );
  return (rows as unknown as {
    id: string;
    visited_on: string;
    saved_places: SavedRow;
    visit_ratings: Rating[];
  }[]).map((r) => ({
    id: r.id,
    visited_on: r.visited_on,
    place: toSaved(r.saved_places),
    ratings: r.visit_ratings,
  }));
}

export async function deleteVisit(visitId: string) {
  check(await db().from("visits").delete().eq("id", visitId));
}
