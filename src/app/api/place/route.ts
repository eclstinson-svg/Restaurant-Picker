import { getDetails, hasGoogleKey } from "@/lib/google";
import { mockDetails } from "@/lib/mock";

// GET /api/place?id=...&lat=..&lng=..  ->  RestaurantDetails
// lat/lng are the search origin, used to compute distance.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const origin = { lat: Number(params.get("lat")), lng: Number(params.get("lng")) };
  if (!id || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!hasGoogleKey()) {
    const details = mockDetails(id, origin);
    return details
      ? Response.json(details)
      : Response.json({ error: "Not found." }, { status: 404 });
  }

  try {
    return Response.json(await getDetails(id, origin));
  } catch {
    return Response.json({ error: "Couldn't load restaurant details." }, { status: 502 });
  }
}
