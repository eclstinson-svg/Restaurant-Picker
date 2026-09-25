"use client";

import { useRef, useState } from "react";
import { CUISINES, POPULAR_CUISINES } from "@/lib/cuisines";
import { MAX_RADIUS_MILES } from "@/lib/geo";
import type {
  LatLng,
  PriceLevel,
  RestaurantDetails,
  RestaurantSummary,
  SearchFilters,
} from "@/lib/types";
import { useAccount } from "./AccountProvider";
import { LocationInput } from "./LocationInput";
import { PlaceActions } from "./PlaceActions";
import { priceText, ResultCard } from "./ResultCard";
import { LocateIcon, ShuffleIcon } from "./icons";
import { cardClass, chipClass, labelClass as label, primaryButton, secondaryButton } from "./ui";

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
  // Set when you use GPS or pick a suggestion; typing clears it (then we look up the text).
  const [pickedOrigin, setPickedOrigin] = useState<LatLng | null>(null);
  const [lastOrigin, setLastOrigin] = useState<LatLng | null>(null); // biases suggestions
  const [radius, setRadius] = useState(10);
  const [cuisines, setCuisines] = useState<string[]>([]); // none = any
  const [showAllCuisines, setShowAllCuisines] = useState(false);
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

  function toggleCuisine(type: string) {
    setCuisines((prev) => (prev.includes(type) ? prev.filter((c) => c !== type) : [...prev, type]));
  }

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
        setPickedOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationText("Current location");
        setError(null);
        setLocating(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked for this site. Allow location for your browser in your phone's settings (and for this site in the browser), then try again. Or just type a place."
            : err.code === err.TIMEOUT
              ? "Finding your location took too long. Try again, or type a place."
              : "Your device couldn't figure out where you are. Make sure Location is turned on, or type a place.",
        );
        setLocating(false);
      },
      // Accept a location from the last 5 minutes; it's plenty accurate for this.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
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
      let from = pickedOrigin;
      if (!from) {
        if (!locationText.trim()) throw new Error("Enter a location or use your current location.");
        const geo = await getJson<{ location: LatLng }>(
          `/api/geocode?address=${encodeURIComponent(locationText)}`,
        );
        from = geo.location;
      }
      origin.current = from;
      setLastOrigin(from);

      // 2. Find restaurants that match the filters.
      const filters: SearchFilters = {
        location: from,
        radiusMiles: radius,
        cuisines,
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

  const visibleCuisines = showAllCuisines
    ? CUISINES
    : CUISINES.filter((c) => POPULAR_CUISINES.includes(c.type) || cuisines.includes(c.type));

  return (
    <div className="space-y-5">
      <form
        className={`${cardClass} space-y-6`}
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
            <LocationInput
              value={locationText}
              onChange={(text) => {
                setLocationText(text);
                setPickedOrigin(null); // typing replaces a previously chosen place
              }}
              onSelect={(loc) => {
                setPickedOrigin(loc);
                setError(null);
              }}
              onError={setError}
              near={pickedOrigin ?? lastOrigin}
            />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              title="Use my current location"
              aria-label="Use my current location"
              className={`${secondaryButton} shrink-0 px-3 text-muted hover:text-accent`}
            >
              <LocateIcon className={`h-5 w-5 ${locating ? "animate-pulse" : ""}`} />
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="radius" className="text-sm font-medium">
              Distance
            </label>
            <span className="text-sm font-medium tabular-nums text-accent">Within {radius} mi</span>
          </div>
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

        <fieldset>
          <div className="mb-2 flex items-baseline justify-between">
            <legend className="text-sm font-medium">Cuisine</legend>
            {cuisines.length > 0 ? (
              <button type="button" className="text-xs font-medium text-muted hover:text-accent" onClick={() => setCuisines([])}>
                Clear ({cuisines.length})
              </button>
            ) : (
              <span className="text-xs text-muted">Any — tap to narrow down</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleCuisines.map((c) => (
              <button
                key={c.type}
                type="button"
                aria-pressed={cuisines.includes(c.type)}
                onClick={() => toggleCuisine(c.type)}
                className={chipClass}
              >
                {c.label}
              </button>
            ))}
            {(showAllCuisines || visibleCuisines.length < CUISINES.length) && (
              <button
                type="button"
                onClick={() => setShowAllCuisines(!showAllCuisines)}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft"
              >
                {showAllCuisines ? "Fewer" : `+${CUISINES.length - visibleCuisines.length} more`}
              </button>
            )}
          </div>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <fieldset>
            <legend className={label}>
              Price {prices.length === 0 && <span className="font-normal text-muted">· any</span>}
            </legend>
            <div className="flex gap-2">
              {([1, 2, 3, 4] as PriceLevel[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={prices.includes(p)}
                  onClick={() => togglePrice(p)}
                  className={`${chipClass} flex-1`}
                >
                  {priceText(p)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={label}>Rating</legend>
            <div className="flex gap-2">
              {[0, 3.5, 4, 4.5].map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={minRating === r}
                  onClick={() => setMinRating(r)}
                  className={`${chipClass} flex-1 whitespace-nowrap px-2`}
                >
                  {r === 0 ? "Any" : `${r.toFixed(1)}+`}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="space-y-2.5">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={openNow}
              onChange={(e) => setOpenNow(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Only places open right now
          </label>
          {couple && (
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={includeVisited}
                onChange={(e) => setIncludeVisited(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Include places we&rsquo;ve been
            </label>
          )}
        </div>

        <button type="submit" disabled={busy} className={`${primaryButton} w-full py-3 text-base`}>
          <ShuffleIcon className="h-5 w-5" />
          {busy ? "Picking…" : "Pick a restaurant"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      {shufflingName && (
        <div className={`${cardClass} py-10 text-center`}>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Shuffling</p>
          <p className="mt-2 truncate text-2xl font-semibold text-accent">{shufflingName}</p>
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
