import { geocode, hasGoogleKey } from "@/lib/google";
import { MOCK_CENTER } from "@/lib/mock";

// GET /api/geocode?address=Austin,TX  ->  { location: {lat,lng}, label }
export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address) {
    return Response.json({ error: "Enter a location." }, { status: 400 });
  }

  if (!hasGoogleKey()) {
    return Response.json({ location: MOCK_CENTER, label: `${address} (sample data)` });
  }

  try {
    const result = await geocode(address);
    if (!result) {
      return Response.json({ error: `Couldn't find "${address}".` }, { status: 404 });
    }
    return Response.json(result);
  } catch {
    return Response.json({ error: "Location lookup failed. Try again." }, { status: 502 });
  }
}
