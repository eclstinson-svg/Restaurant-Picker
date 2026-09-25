import { hasGoogleKey, placeLocation } from "@/lib/google";

// GET /api/place-location?id=<placeId>&session=<uuid>  ->  { location, label }
// Looks up the coordinates of a place picked from the autocomplete list.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const session = params.get("session");
  if (!id || !/^[\w-]+$/.test(id) || !session || !hasGoogleKey()) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    return Response.json(await placeLocation(id, session));
  } catch {
    return Response.json({ error: "Couldn't look up that place." }, { status: 502 });
  }
}
