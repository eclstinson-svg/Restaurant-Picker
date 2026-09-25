import "server-only";
import { CUISINES, cuisineLabel, matchesStyle, STYLES } from "./cuisines";
import { distanceMiles } from "./geo";
import type {
  ChosenPlace,
  LatLng,
  PriceLevel,
  RestaurantDetails,
  RestaurantSummary,
  SearchFilters,
  Suggestion,
} from "./types";

// All calls to Google live in this file. It only ever runs on the server,
// so the API key is never sent to the browser.

const PLACES_URL = "https://places.googleapis.com/v1";

export function hasGoogleKey(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  return key;
}

const PRICE_LEVELS: Record<string, PriceLevel> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// The subset of Google's Place object that we ask for.
type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  currentOpeningHours?: { openNow?: boolean };
  editorialSummary?: { text: string };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  photos?: {
    name: string;
    authorAttributions?: { displayName: string }[];
  }[];
  reviews?: {
    rating?: number;
    text?: { text: string };
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName: string };
  }[];
};

// Fields for the search. Google bills by which fields you request, so the
// search asks for the minimum and the winner's details are fetched separately.
const SUMMARY_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "primaryTypeDisplayName",
  "currentOpeningHours.openNow",
];

const DETAIL_FIELDS = [
  ...SUMMARY_FIELDS,
  "editorialSummary",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "photos",
  "reviews",
];

function toSummary(p: GooglePlace, origin: LatLng): RestaurantSummary {
  const location = {
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
  };
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unnamed restaurant",
    address: p.formattedAddress ?? "",
    location,
    distanceMiles: distanceMiles(origin, location),
    rating: p.rating,
    ratingCount: p.userRatingCount,
    price: p.priceLevel ? PRICE_LEVELS[p.priceLevel] : undefined,
    cuisineLabel: p.primaryTypeDisplayName?.text,
    openNow: p.currentOpeningHours?.openNow,
  };
}

async function googleFetch<T>(url: string, init: RequestInit & { fields?: string[] } = {}): Promise<T> {
  const { fields, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      ...(fields ? { "X-Goog-FieldMask": fields.join(",") } : {}),
      ...rest.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    // Log the full error on the server; the browser gets a generic message.
    console.error("Google API error", res.status, await res.text());
    throw new Error(`Google API request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// Turn a typed address ("Austin, TX") into coordinates.
export async function geocode(address: string): Promise<{ location: LatLng; label: string } | null> {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?" +
    new URLSearchParams({ address, key: apiKey() });
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK") {
    console.error("Geocoding error", data.status, data.error_message);
    throw new Error(`Geocoding failed (${data.status})`);
  }
  const top = data.results[0];
  return { location: top.geometry.location, label: top.formatted_address };
}

// Gas stations and stores with a food counter are tagged "restaurant" too.
const NOT_REALLY_RESTAURANTS = new Set(["gas_station", "convenience_store", "grocery_store", "supermarket"]);

const PRICE_LEVEL_NAMES: Record<PriceLevel, string> = {
  1: "PRICE_LEVEL_INEXPENSIVE",
  2: "PRICE_LEVEL_MODERATE",
  3: "PRICE_LEVEL_EXPENSIVE",
  4: "PRICE_LEVEL_VERY_EXPENSIVE",
};

// Most Google searches we'll run for one roll (they run at the same time).
const MAX_SEARCHES = 5;

// One Google "Text Search": up to 20 places of `type` inside a box around the
// radius. Unlike nearby search, Google applies price / rating / open-now itself,
// so e.g. "$$$$ only" returns $$$$ places rather than filtering down the 20 most popular.
async function textSearch(f: SearchFilters, type: string, query: string): Promise<GooglePlace[]> {
  // Google only accepts a rectangle here; we trim to the true circle afterwards.
  const dLat = f.radiusMiles / 69;
  const dLng = f.radiusMiles / (69 * Math.cos((f.location.lat * Math.PI) / 180));
  const data = await googleFetch<{ places?: GooglePlace[] }>(
    `${PLACES_URL}/places:searchText`,
    {
      method: "POST",
      fields: [...SUMMARY_FIELDS, "types"].map((field) => `places.${field}`),
      body: JSON.stringify({
        textQuery: query,
        includedType: type,
        strictTypeFiltering: true,
        pageSize: 20,
        locationRestriction: {
          rectangle: {
            low: { latitude: f.location.lat - dLat, longitude: f.location.lng - dLng },
            high: { latitude: f.location.lat + dLat, longitude: f.location.lng + dLng },
          },
        },
        ...(f.prices.length > 0 && { priceLevels: f.prices.map((p) => PRICE_LEVEL_NAMES[p]) }),
        ...(f.minRating > 0 && { minRating: f.minRating }),
        ...(f.openNow && { openNow: true }),
      }),
    },
  );
  return (data.places ?? []).filter((p) => !p.types?.some((t) => NOT_REALLY_RESTAURANTS.has(t)));
}

// Restaurants matching the filters. Each chosen cuisine (and style) gets its
// own search, run at the same time, so every choice gets a fair share of results.
// Note: "places to eat" works better than "restaurant", which Google matches
// against names and so favors places literally called "... Restaurant".
export async function searchRestaurants(f: SearchFilters): Promise<RestaurantSummary[]> {
  // "Most but not all" cuisines (e.g. Select all, minus two): search broadly
  // and drop the ones they unticked, rather than running 20+ searches.
  const allCuisines = CUISINES.map((c) => c.type as string);
  const excludeMode = f.cuisines.length > allCuisines.length / 2;
  const excluded = new Set(excludeMode ? allCuisines.filter((t) => !f.cuisines.includes(t)) : []);
  const cuisinePlans: (string | null)[] = excludeMode || f.cuisines.length === 0 ? [null] : f.cuisines;
  const stylePlans = f.styles.length > 0 ? f.styles.map((s) => STYLES.find((x) => x.id === s)!) : [null];

  // One search per cuisine × style.
  //  checkCuisine: results still need their cuisine checked (broad fallback only)
  //  styleGuaranteed: searched within that style's own type, so no style check needed
  type Plan = { type: string; query: string; checkCuisine: boolean; styleGuaranteed: boolean };
  const byStyle = (style: (typeof STYLES)[number] | null, checkCuisine: boolean): Plan => ({
    type: style?.searchType ?? "restaurant",
    query: style?.query ?? "places to eat",
    checkCuisine,
    styleGuaranteed: Boolean(style && style.id !== "casual"),
  });
  let plans: Plan[] = cuisinePlans.flatMap((cuisine) =>
    stylePlans.map((style): Plan => {
      if (!cuisine) return byStyle(style, false);
      // Cuisine + style (e.g. Mexican + fast food): search within the cuisine and
      // check the style afterwards. Google handles "Mexican fast food" poorly, but
      // "Mexican fast food chain" among Mexican places finds Chipotle, Taco Bell, etc.
      const styleWords = !style || style.id === "casual" ? "places to eat" : style.id === "fast_food" ? "fast food chain" : style.query;
      return { type: cuisine, query: `${cuisineLabel(cuisine)} ${styleWords}`, checkCuisine: false, styleGuaranteed: false };
    }),
  );
  if (plans.length > MAX_SEARCHES) {
    // Too many combinations: search by style (or just broadly) and check cuisine below.
    plans = stylePlans.slice(0, MAX_SEARCHES).map((style) => byStyle(style, true));
  }

  const lists = await Promise.all(
    plans.map(async (plan) => (await textSearch(f, plan.type, plan.query)).map((place) => ({ place, plan }))),
  );
  const results = [...new Map(lists.flat().map((r) => [r.place.id, r])).values()];

  return results
    .filter(({ place, plan }) => {
      const types = place.types ?? [];
      if (excludeMode && types.some((t) => excluded.has(t))) return false;
      if (plan.checkCuisine && !excludeMode && f.cuisines.length > 0 && !types.some((t) => f.cuisines.includes(t))) {
        return false;
      }
      const price = place.priceLevel ? PRICE_LEVELS[place.priceLevel] : undefined;
      return plan.styleGuaranteed || matchesStyle(types, price, f.styles);
    })
    .map(({ place }) => toSummary(place, f.location));
}

// Full details (photo, reviews, website...) for one restaurant.
export async function getDetails(id: string, origin: LatLng): Promise<RestaurantDetails> {
  const p = await googleFetch<GooglePlace>(
    `${PLACES_URL}/places/${encodeURIComponent(id)}`,
    { fields: DETAIL_FIELDS },
  );
  const photo = p.photos?.[0];
  return {
    ...toSummary(p, origin),
    summary: p.editorialSummary?.text,
    phone: p.nationalPhoneNumber,
    website: p.websiteUri,
    googleMapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    photoUrl: photo ? `/api/photo?name=${encodeURIComponent(photo.name)}` : undefined,
    photoCredit: photo?.authorAttributions?.[0]?.displayName,
    reviews: (p.reviews ?? [])
      .filter((r) => r.text?.text)
      .slice(0, 3)
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? "Google user",
        rating: r.rating ?? 0,
        text: r.text!.text,
        when: r.relativePublishTimeDescription ?? "",
      })),
  };
}

// Suggestions as you type: addresses, cities, businesses, parks, landmarks...
// `sessionToken` groups the typing + final pick so Google bills it as one session.
export async function autocomplete(
  input: string,
  sessionToken: string,
  near?: LatLng,
  onlyTypes?: string[], // e.g. restaurant types; max 5
): Promise<Suggestion[]> {
  type Prediction = {
    placeId: string;
    text?: { text: string };
    structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
  };
  const data = await googleFetch<{ suggestions?: { placePrediction?: Prediction }[] }>(
    `${PLACES_URL}/places:autocomplete`,
    {
      method: "POST",
      body: JSON.stringify({
        input,
        sessionToken,
        ...(onlyTypes && { includedPrimaryTypes: onlyTypes }),
        // Prefer results near the user rather than anywhere in the world.
        ...(near && {
          locationBias: {
            circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50000 },
          },
        }),
      }),
    },
  );
  return (data.suggestions ?? []).flatMap(({ placePrediction: p }) =>
    p
      ? [
          {
            id: p.placeId,
            main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
            secondary: p.structuredFormat?.secondaryText?.text ?? "",
          },
        ]
      : [],
  );
}

// A place chosen from the suggestions. Ends the autocomplete session.
export async function placeLocation(
  id: string,
  sessionToken: string,
  withRestaurantInfo = false,
): Promise<ChosenPlace> {
  const fields = ["id", "location", "displayName", "formattedAddress"];
  if (withRestaurantInfo) fields.push("priceLevel", "primaryTypeDisplayName", "googleMapsUri");
  const p = await googleFetch<GooglePlace>(
    `${PLACES_URL}/places/${encodeURIComponent(id)}?sessionToken=${encodeURIComponent(sessionToken)}`,
    { fields },
  );
  if (!p.location) throw new Error("Place has no location");
  return {
    location: { lat: p.location.latitude, lng: p.location.longitude },
    label: p.displayName?.text ?? p.formattedAddress ?? "",
    ...(withRestaurantInfo && {
      restaurant: {
        id: p.id,
        name: p.displayName?.text ?? "Unnamed restaurant",
        address: p.formattedAddress ?? "",
        cuisineLabel: p.primaryTypeDisplayName?.text,
        price: p.priceLevel ? PRICE_LEVELS[p.priceLevel] : undefined,
        googleMapsUrl: p.googleMapsUri,
      },
    }),
  };
}

// Google photo names look like "places/<placeId>/photos/<photoId>".
const PHOTO_NAME = /^places\/[\w-]+\/photos\/[\w-]+$/;

// Returns a short-lived public image URL for a place photo.
export async function getPhotoUrl(name: string): Promise<string | null> {
  if (!PHOTO_NAME.test(name)) return null;
  const data = await googleFetch<{ photoUri?: string }>(
    `${PLACES_URL}/${name}/media?maxWidthPx=900&skipHttpRedirect=true`,
  );
  return data.photoUri ?? null;
}
