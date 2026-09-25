// Shared shapes used by both the server (API routes) and the browser (UI).

export type PriceLevel = 1 | 2 | 3 | 4; // $ .. $$$$

export type LatLng = { lat: number; lng: number };

// Kind of place, independent of cuisine.
export type Style = "fast_food" | "casual" | "fine_dining" | "bar" | "cafe";

// One row in the location search dropdown.
export type Suggestion = { id: string; main: string; secondary: string };

// What we get back after choosing a suggestion.
export type ChosenPlace = {
  location: LatLng;
  label: string;
  // Only for the restaurant search (logging a visit), since these fields cost more.
  restaurant?: {
    id: string;
    name: string;
    address: string;
    cuisineLabel?: string;
    price?: PriceLevel;
    googleMapsUrl?: string;
  };
};

// What the user picks in the form.
export type SearchFilters = {
  location: LatLng;
  radiusMiles: number;
  cuisines: string[]; // Google place types, e.g. "italian_restaurant"; empty = any
  styles: Style[]; // kind of place; empty = any
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
