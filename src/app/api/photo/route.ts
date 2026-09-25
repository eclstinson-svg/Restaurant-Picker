import { getPhotoUrl, hasGoogleKey } from "@/lib/google";

// GET /api/photo?name=places/.../photos/...  ->  redirects to the image.
// Going through the server keeps the API key out of the browser.
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name");
  if (!name || !hasGoogleKey()) {
    return new Response(null, { status: 404 });
  }
  try {
    const url = await getPhotoUrl(name);
    if (!url) return new Response(null, { status: 404 });
    return Response.redirect(url, 302);
  } catch {
    return new Response(null, { status: 502 });
  }
}
