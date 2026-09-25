"use client";

import { useRef, useState } from "react";
import { CUISINES } from "@/lib/cuisines";
import { MAX_RADIUS_MILES } from "@/lib/geo";
import type {
  LatLng,
  PriceLevel,
  RestaurantDetails,
  RestaurantSummary,
  SearchFilters,
} from "@/lib/types";
import { useAccount } from "./AccountProvider";
import { PlaceActions } from "./PlaceActions";
import { priceText, ResultCard } from "./ResultCard";
import { fieldClass as field, labelClass as label } from "./ui";

const SHUFFLE_MS = 1200; // how long the name-shuffle animation runs

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Picker() {
  const { couple, saved } = useAccount();
  const [includeVisited, setIncludeVisited] = useState(false);

  // Filters
  const [locationText, setLocationText] = useState("");
  const [gpsOrigin, setGpsOrigin] = useState<LatLng | null>(null);
  const [radius, setRadius] = useState(10);
  const [cuisine, setCuisine] = useState("restaurant");
  const [prices, setPrices] = useState<PriceLevel[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [openNow, setOpenNow] = useState(false);

  // Results
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shufflingName, setShufflingName] = useState<string | null>(null);
  const [current, setCurrent] = useState<RestaurantDetails | null>(null);
  const [sample, setSample] = useState(false);

  // Values the re-roll button needs, kept between spins.
  const queue = useRef<RestaurantSummary[]>([]);
  const matches = useRef<RestaurantSummary[]>([]);
  const origin = useRef<LatLng | null>(null);
  const [remaining, setRemaining] = useState(0);

  function togglePrice(p: PriceLevel) {
    setPrices((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort()));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser can't share its location. Type a place instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationText("📍 My current location");
        setError(null);
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location. Check location permissions or type a place.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  // Show a quick "slot machine" of names while the winner's details load.
  async function reveal(pick: RestaurantSummary, pool: RestaurantSummary[]) {
    setCurrent(null);
    const details = getJson<RestaurantDetails>(
      `/api/place?${new URLSearchParams({
        id: pick.id,
        lat: String(origin.current!.lat),
        lng: String(origin.current!.lng),
      })}`,
    );
    details.catch(() => {}); // errors are handled below; this stops an early "unhandled" warning
    if (pool.length > 1) {
      const end = Date.now() + SHUFFLE_MS;
      while (Date.now() < end) {
        setShufflingName(pool[Math.floor(Math.random() * pool.length)].name);
        await wait(90);
      }
    }
    try {
      setCurrent(await details);
    } finally {
      setShufflingName(null);
    }
  }

  async function spin() {
    setError(null);
    setBusy(true);
    try {
      // 1. Work out where we're searching from.
      let from = gpsOrigin;
      if (!from) {
        if (!locationText.trim()) throw new Error("Enter a location or use your current location.");
        const geo = await getJson<{ location: LatLng }>(
          `/api/geocode?address=${encodeURIComponent(locationText)}`,
        );
        from = geo.location;
      }
      origin.current = from;

      // 2. Find restaurants that match the filters.
      const filters: SearchFilters = {
        location: from,
        radiusMiles: radius,
        cuisine,
        prices,
        includeUnknownPrice: true,
        minRating,
        openNow,
      };
      const { results, sample } = await getJson<{
        results: RestaurantSummary[];
        sample: boolean;
      }>("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      setSample(sample);
      if (results.length === 0) {
        setCurrent(null);
        throw new Error("No restaurants matched. Try a bigger radius or fewer filters.");
      }

      // 3. Leave out places you've hidden, and (unless asked) places you've been.
      const hidden = new Set(saved.filter((s) => s.blocked).map((s) => s.place_id));
      const visited = new Set(saved.filter((s) => s.visitCount > 0).map((s) => s.place_id));
      const pool = results.filter(
        (r) => !hidden.has(r.id) && (includeVisited || !visited.has(r.id)),
      );
      if (pool.length === 0) {
        setCurrent(null);
        throw new Error(
          `You've already been to (or hidden) all ${results.length} matches! ` +
            "Tick “Include places we've been”, or widen the search.",
        );
      }

      // 4. Shuffle them and reveal the first one.
      matches.current = pool;
      queue.current = shuffle(pool);
      const pick = queue.current.shift()!;
      setRemaining(queue.current.length);
      await reveal(pick, pool);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // After "Not for us": drop the current place for good and move on.
  function hideCurrent() {
    matches.current = matches.current.filter((m) => m.id !== current?.id);
    queue.current = queue.current.filter((m) => m.id !== current?.id);
    if (matches.current.length === 0) {
      setCurrent(null);
      setError("That was the last match. Try a new search.");
      return;
    }
    reroll();
  }

  async function reroll() {
    if (queue.current.length === 0) {
      // Everything has been shown once; reshuffle, but don't repeat the current one first.
      queue.current = shuffle(matches.current.filter((m) => m.id !== current?.id));
      const same = matches.current.find((m) => m.id === current?.id);
      if (same) queue.current.push(same);
    }
    const pick = queue.current.shift();
    if (!pick) return;
    setRemaining(queue.current.length);
    setBusy(true);
    setError(null);
    try {
      await reveal(pick, matches.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="space-y-5 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-black/5"
        onSubmit={(e) => {
          e.preventDefault();
          spin();
        }}
      >
        <div>
          <label htmlFor="location" className={label}>
            Starting from
          </label>
          <div className="flex gap-2">
            <input
              id="location"
              className={field}
              placeholder="City, address, or ZIP"
              value={locationText}
              onChange={(e) => {
                setLocationText(e.target.value);
                setGpsOrigin(null); // typing replaces the GPS location
              }}
            />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              title="Use my current location"
              className="shrink-0 rounded-xl px-3.5 ring-1 ring-black/10 hover:bg-subtle disabled:opacity-50 dark:ring-white/15"
            >
              {locating ? "…" : "📍"}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="radius" className={label}>
            Within <span className="text-accent">{radius} miles</span>
          </label>
          <input
            id="radius"
            type="range"
            min={1}
            max={MAX_RADIUS_MILES}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cuisine" className={label}>
              Cuisine
            </label>
            <select
              id="cuisine"
              className={field}
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
            >
              {CUISINES.map((c) => (
                <option key={c.type} value={c.type}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rating" className={label}>
              Min rating
            </label>
            <select
              id="rating"
              className={field}
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
            >
              <option value={0}>Any</option>
              <option value={3.5}>3.5+ ★</option>
              <option value={4}>4.0+ ★</option>
              <option value={4.5}>4.5+ ★</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend className={label}>Price {prices.length === 0 && <span className="font-normal text-muted">(any)</span>}</legend>
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as PriceLevel[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={prices.includes(p)}
                onClick={() => togglePrice(p)}
                className="rounded-xl py-2.5 font-semibold ring-1 ring-black/10 transition-colors aria-pressed:bg-accent aria-pressed:text-white aria-pressed:ring-accent dark:ring-white/15"
              >
                {priceText(p)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={openNow}
            onChange={(e) => setOpenNow(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Only places open right now
        </label>

        {couple && (
          <label className="-mt-2 flex items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={includeVisited}
              onChange={(e) => setIncludeVisited(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Include places we&rsquo;ve been
          </label>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-accent py-4 text-lg font-bold text-white shadow-lg shadow-accent/30 transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Picking…" : "🎲 Pick for us!"}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </p>
      )}

      {shufflingName && (
        <div className="rounded-3xl bg-card p-10 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Shuffling…</p>
          <p className="mt-2 truncate text-2xl font-bold text-accent">{shufflingName}</p>
        </div>
      )}

      {current && !shufflingName && (
        <ResultCard place={current} sample={sample} onReroll={reroll} remaining={remaining}>
          <PlaceActions key={current.id} place={current} onHidden={hideCurrent} />
        </ResultCard>
      )}
    </div>
  );
}
