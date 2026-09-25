// Shared shapes used by both the server (API routes) and the browser (UI).

export type PriceLevel = 1 | 2 | 3 | 4; // $ .. $$$$

export type LatLng = { lat: number; lng: number };

// One row in the location search dropdown.
export type Suggestion = { id: string; main: string; secondary: string };

// What the user picks in the form.
export type SearchFilters = {
  location: LatLng;
  radiusMiles: number;
  cuisines: string[]; // Google place types, e.g. "italian_restaurant"; empty = any
  prices: PriceLevel[]; // empty = any price
  includeUnknownPrice: boolean; // many places have no price listed on Google
  minRating: number; // 0 = any
  openNow: boolean;
};

// A lightweight search result. We fetch full details only for the winner,
// which keeps Google API costs down.
export type RestaurantSummary = {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  distanceMiles: number;
  rating?: number;
  ratingCount?: number;
  price?: PriceLevel;
  cuisineLabel?: string;
  openNow?: boolean;
};

export type Review = {
  author: string;
  rating: number;
  text: string;
  when: string; // e.g. "2 months ago"
};

export type RestaurantDetails = RestaurantSummary & {
  summary?: string;
  phone?: string;
  website?: string;
  googleMapsUrl: string;
  photoUrl?: string;
  photoCredit?: string; // Google requires showing who took the photo
  reviews: Review[];
};
