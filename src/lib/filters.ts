import type { RestaurantSummary, SearchFilters } from "./types";

// Filters Google can't apply for us in a nearby search, so we apply them
// ourselves after the results come back. Used for both real and sample data.
export function applyFilters(
  places: RestaurantSummary[],
  f: SearchFilters,
): RestaurantSummary[] {
  return places.filter((p) => {
    if (p.distanceMiles > f.radiusMiles) return false;
    if (f.prices.length > 0) {
      if (p.price === undefined) {
        if (!f.includeUnknownPrice) return false;
      } else if (!f.prices.includes(p.price)) {
        return false;
      }
    }
    if (f.minRating > 0 && (p.rating ?? 0) < f.minRating) return false;
    if (f.openNow && p.openNow !== true) return false;
    return true;
  });
}
