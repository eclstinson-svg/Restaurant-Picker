import { cuisineLabel } from "./cuisines";
import { distanceMiles } from "./geo";
import type { LatLng, PriceLevel, RestaurantDetails, RestaurantSummary } from "./types";

// Made-up restaurants used when no Google API key is configured, so the app
// can be built and tried out for free. They're placed around whatever
// location you search from.

type MockPlace = {
  id: string;
  name: string;
  cuisine: string;
  milesNorth: number;
  milesEast: number;
  rating: number;
  ratingCount: number;
  price?: PriceLevel;
  openNow: boolean;
  summary: string;
};

const MOCK_PLACES: MockPlace[] = [
  { id: "mock-1", name: "Nonna's Table", cuisine: "italian_restaurant", milesNorth: 1.2, milesEast: 0.5, rating: 4.6, ratingCount: 812, price: 2, openNow: true, summary: "Handmade pasta and a candlelit dining room." },
  { id: "mock-2", name: "Golden Lotus", cuisine: "thai_restaurant", milesNorth: -0.8, milesEast: 2.1, rating: 4.4, ratingCount: 390, price: 1, openNow: true, summary: "Family-run Thai spot known for its khao soi." },
  { id: "mock-3", name: "Ember & Oak", cuisine: "steak_house", milesNorth: 4.5, milesEast: -3.0, rating: 4.7, ratingCount: 1204, price: 4, openNow: false, summary: "Wood-fired steaks and a long wine list." },
  { id: "mock-4", name: "Taquería El Sol", cuisine: "mexican_restaurant", milesNorth: 0.3, milesEast: -0.9, rating: 4.5, ratingCount: 2100, price: 1, openNow: true, summary: "Al pastor off the trompo and fresh salsas." },
  { id: "mock-5", name: "Sakura Sushi Bar", cuisine: "sushi_restaurant", milesNorth: -2.4, milesEast: -1.7, rating: 4.3, ratingCount: 540, price: 3, openNow: true, summary: "Omakase counter with fish flown in daily." },
  { id: "mock-6", name: "The Rusty Spoon", cuisine: "american_restaurant", milesNorth: 6.1, milesEast: 2.2, rating: 4.1, ratingCount: 260, price: 2, openNow: true, summary: "Comfort food and craft beer." },
  { id: "mock-7", name: "Saffron House", cuisine: "indian_restaurant", milesNorth: -5.5, milesEast: 4.0, rating: 4.6, ratingCount: 975, price: 2, openNow: false, summary: "Northern Indian curries and a lunch buffet." },
  { id: "mock-8", name: "Pho Real", cuisine: "vietnamese_restaurant", milesNorth: 2.0, milesEast: 6.5, rating: 4.4, ratingCount: 688, openNow: true, summary: "Big bowls of pho and banh mi." },
  { id: "mock-9", name: "Olive & Fig", cuisine: "mediterranean_restaurant", milesNorth: -1.1, milesEast: -4.8, rating: 4.2, ratingCount: 330, price: 2, openNow: true, summary: "Mezze plates on a sunny patio." },
  { id: "mock-10", name: "Smoke Signal BBQ", cuisine: "barbecue_restaurant", milesNorth: 9.0, milesEast: -6.0, rating: 4.8, ratingCount: 3120, price: 2, openNow: true, summary: "Brisket that sells out by 2pm." },
  { id: "mock-11", name: "Le Petit Bistro", cuisine: "french_restaurant", milesNorth: -7.3, milesEast: -2.5, rating: 4.5, ratingCount: 450, price: 3, openNow: false, summary: "Classic bistro fare and a great date-night vibe." },
  { id: "mock-12", name: "Seoul Kitchen", cuisine: "korean_restaurant", milesNorth: 3.3, milesEast: -7.7, rating: 4.3, ratingCount: 720, price: 2, openNow: true, summary: "Tabletop Korean BBQ." },
  { id: "mock-13", name: "Slice of Brooklyn", cuisine: "pizza_restaurant", milesNorth: 0.9, milesEast: 1.4, rating: 4.0, ratingCount: 1500, price: 1, openNow: true, summary: "Thin crust by the slice, open late." },
  { id: "mock-14", name: "The Oyster Shack", cuisine: "seafood_restaurant", milesNorth: -12.0, milesEast: 8.0, rating: 4.4, ratingCount: 610, price: 3, openNow: true, summary: "Raw bar and lobster rolls." },
  { id: "mock-15", name: "Ramen Ya", cuisine: "ramen_restaurant", milesNorth: 14.0, milesEast: 5.0, rating: 4.6, ratingCount: 880, price: 2, openNow: true, summary: "Rich tonkotsu and a line out the door." },
  { id: "mock-16", name: "Athena Taverna", cuisine: "greek_restaurant", milesNorth: -18.0, milesEast: -9.0, rating: 4.2, ratingCount: 290, price: 2, openNow: false, summary: "Gyros, grilled octopus, and flaming saganaki." },
];

const MOCK_REVIEWS = [
  { author: "Jamie L.", rating: 5, text: "One of our favorite date spots. Service was warm and the food came out fast.", when: "2 weeks ago" },
  { author: "Priya S.", rating: 4, text: "Really good food, a bit loud on a Friday night. Would go back.", when: "a month ago" },
  { author: "Marcus T.", rating: 5, text: "Get whatever the server recommends. Portions are generous.", when: "3 months ago" },
];

function place(m: MockPlace, origin: LatLng): RestaurantSummary {
  // ~69 miles per degree of latitude; longitude degrees shrink toward the poles.
  const location = {
    lat: origin.lat + m.milesNorth / 69,
    lng: origin.lng + m.milesEast / (69 * Math.cos((origin.lat * Math.PI) / 180)),
  };
  return {
    id: m.id,
    name: m.name,
    address: "123 Example St (sample data)",
    location,
    distanceMiles: distanceMiles(origin, location),
    rating: m.rating,
    ratingCount: m.ratingCount,
    price: m.price,
    cuisineLabel: cuisineLabel(m.cuisine),
    openNow: m.openNow,
  };
}

export function mockSearch(origin: LatLng, cuisines: string[]): RestaurantSummary[] {
  return MOCK_PLACES.filter((m) => cuisines.length === 0 || cuisines.includes(m.cuisine)).map(
    (m) => place(m, origin),
  );
}

export function mockDetails(id: string, origin: LatLng): RestaurantDetails | null {
  const m = MOCK_PLACES.find((p) => p.id === id);
  if (!m) return null;
  const p = place(m, origin);
  return {
    ...p,
    summary: m.summary,
    phone: "(555) 010-0000",
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${p.location.lat},${p.location.lng}`,
    reviews: MOCK_REVIEWS,
  };
}

// Fixed point used when you type an address without a Google key.
export const MOCK_CENTER: LatLng = { lat: 30.2672, lng: -97.7431 };
