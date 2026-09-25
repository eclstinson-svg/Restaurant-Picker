import { hasGoogleKey, placeLocation } from "@/lib/google";

// GET /api/place-location?id=<placeId>&session=<uuid>[&kind=food]
//   ->  { location, label, restaurant? }
// Looks up a place picked from the autocomplete list. With kind=food it also
// returns the restaurant's name, cuisine, price, etc. (for logging a visit).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const session = params.get("session");
  if (!id || !/^[\w-]+$/.test(id) || !session || !hasGoogleKey()) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    return Response.json(await placeLocation(id, session, params.get("kind") === "food"));
  } catch {
    return Response.json({ error: "Couldn't look up that place." }, { status: 502 });
  }
}
