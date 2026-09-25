import { CUISINES } from "@/lib/cuisines";
import { applyFilters } from "@/lib/filters";
import { MAX_RADIUS_MILES } from "@/lib/geo";
import { hasGoogleKey, searchNearby } from "@/lib/google";
import { mockSearch } from "@/lib/mock";
import type { PriceLevel, SearchFilters } from "@/lib/types";

// POST /api/search  body: SearchFilters  ->  { results, sample }
export async function POST(request: Request) {
  const filters = parseFilters(await request.json().catch(() => null));
  if (!filters) {
    return Response.json({ error: "Invalid search." }, { status: 400 });
  }

  try {
    const sample = !hasGoogleKey();
    const places = sample
      ? mockSearch(filters.location, filters.cuisines)
      : await searchNearby(filters);
    return Response.json({ results: applyFilters(places, filters), sample });
  } catch {
    return Response.json({ error: "Restaurant search failed. Try again." }, { status: 502 });
  }
}

// Never trust input from the browser: check every field before using it.
function parseFilters(body: unknown): SearchFilters | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const loc = b.location as Record<string, unknown> | undefined;
  const lat = Number(loc?.lat);
  const lng = Number(loc?.lng);
  const radius = Number(b.radiusMiles);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) return null;

  const cuisines = Array.isArray(b.cuisines) ? b.cuisines.map(String) : [];
  if (!cuisines.every((type) => CUISINES.some((c) => c.type === type))) return null;

  const prices = (Array.isArray(b.prices) ? b.prices : []).filter(
    (p): p is PriceLevel => [1, 2, 3, 4].includes(p),
  );

  return {
    location: { lat, lng },
    radiusMiles: Math.min(Math.max(radius, 0.5), MAX_RADIUS_MILES),
    cuisines: [...new Set(cuisines)],
    prices,
    includeUnknownPrice: b.includeUnknownPrice !== false,
    minRating: Math.min(Math.max(Number(b.minRating) || 0, 0), 5),
    openNow: b.openNow === true,
  };
}
