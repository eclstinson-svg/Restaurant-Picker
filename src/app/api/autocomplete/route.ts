import { autocomplete, hasGoogleKey } from "@/lib/google";
import type { LatLng } from "@/lib/types";

// Place types used when searching for somewhere to eat (Google allows up to 5).
const FOOD_TYPES = ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"];

// GET /api/autocomplete?q=zilker&session=<uuid>[&lat=..&lng=..][&kind=food]  ->  { suggestions }
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 200);
  const session = params.get("session");
  if (!q || !session || !hasGoogleKey()) {
    return Response.json({ suggestions: [] }); // sample mode: just type and search
  }
  const onlyTypes = params.get("kind") === "food" ? FOOD_TYPES : undefined;

  try {
    return Response.json({
      suggestions: await autocomplete(q, session, nearUser(request, params), onlyTypes),
    });
  } catch {
    return Response.json({ error: "Suggestions unavailable." }, { status: 502 });
  }
}

// Where to center suggestions: the last place searched from, if the page
// sent one; otherwise Vercel's rough guess of the visitor's location from
// their internet connection (not available when running locally).
function nearUser(request: Request, params: URLSearchParams): LatLng | undefined {
  const fromPage = { lat: Number(params.get("lat")), lng: Number(params.get("lng")) };
  if (params.has("lat") && Number.isFinite(fromPage.lat) && Number.isFinite(fromPage.lng)) {
    return fromPage;
  }
  const lat = Number(request.headers.get("x-vercel-ip-latitude"));
  const lng = Number(request.headers.get("x-vercel-ip-longitude"));
  if (request.headers.has("x-vercel-ip-latitude") && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return undefined;
}
