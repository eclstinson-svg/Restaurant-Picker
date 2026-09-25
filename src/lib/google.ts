import "server-only";
import { cuisineLabel } from "./cuisines";
import { distanceMiles, METERS_PER_MILE } from "./geo";
import type {
  LatLng,
  PriceLevel,
  RestaurantDetails,
  RestaurantSummary,
  SearchFilters,
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

function toSummary(p: GooglePlace, origin: LatLng, cuisine?: string): RestaurantSummary {
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
    cuisineLabel:
      p.primaryTypeDisplayName?.text ?? (cuisine ? cuisineLabel(cuisine) : undefined),
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

// Up to 20 restaurants of the chosen cuisine inside the radius.
export async function searchNearby(f: SearchFilters): Promise<RestaurantSummary[]> {
  const data = await googleFetch<{ places?: GooglePlace[] }>(
    `${PLACES_URL}/places:searchNearby`,
    {
      method: "POST",
      fields: SUMMARY_FIELDS.map((field) => `places.${field}`),
      body: JSON.stringify({
        includedTypes: [f.cuisine],
        maxResultCount: 20,
        rankPreference: "POPULARITY",
        locationRestriction: {
          circle: {
            center: { latitude: f.location.lat, longitude: f.location.lng },
            radius: Math.min(f.radiusMiles * METERS_PER_MILE, 50000),
          },
        },
      }),
    },
  );
  return (data.places ?? []).map((p) => toSummary(p, f.location, f.cuisine));
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
