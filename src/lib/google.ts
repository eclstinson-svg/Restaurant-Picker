import "server-only";
import { cuisineLabel } from "./cuisines";
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

// Picking more cuisines than this runs one broad search instead of one per cuisine.
const MAX_SEPARATE_CUISINE_SEARCHES = 5;

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

// Restaurants matching the filters. With a few cuisines picked, each gets its
// own search (run at the same time) so every cuisine gets a fair share.
export async function searchRestaurants(f: SearchFilters): Promise<RestaurantSummary[]> {
  let places: GooglePlace[];
  // "places to eat" works better than "restaurant", which Google matches against
  // names and so favors places literally called "... Restaurant".
  if (f.cuisines.length === 0) {
    places = await textSearch(f, "restaurant", "places to eat");
  } else if (f.cuisines.length <= MAX_SEPARATE_CUISINE_SEARCHES) {
    const lists = await Promise.all(
      f.cuisines.map((c) => textSearch(f, c, `${cuisineLabel(c)} places to eat`)),
    );
    const byId = new Map(lists.flat().map((p) => [p.id, p]));
    places = [...byId.values()];
  } else {
    const wanted = new Set(f.cuisines);
    places = (await textSearch(f, "restaurant", "places to eat")).filter((p) =>
      p.types?.some((t) => wanted.has(t)),
    );
  }
  return places.map((p) => toSummary(p, f.location));
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
