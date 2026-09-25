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

// Chains show up once per location ("Chipotle" x3). Keep only the closest
// location of each name so a re-roll doesn't feel like a repeat.
export function oneLocationPerName(places: RestaurantSummary[]): RestaurantSummary[] {
  const byName = new Map<string, RestaurantSummary>();
  for (const p of places) {
    const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = byName.get(key);
    if (!existing || p.distanceMiles < existing.distanceMiles) byName.set(key, p);
  }
  return [...byName.values()];
}
