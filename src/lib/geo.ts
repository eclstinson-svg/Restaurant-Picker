import type { LatLng } from "./types";

export const METERS_PER_MILE = 1609.344;

// Google's nearby search allows a radius of at most 50 km (~31 miles).
export const MAX_RADIUS_MILES = 30;

// Straight-line distance between two points on Earth, in miles.
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
