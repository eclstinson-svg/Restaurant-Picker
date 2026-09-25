"use client";

import { useRef, useState } from "react";
import { STYLES } from "@/lib/cuisines";
import { MAX_RADIUS_MILES } from "@/lib/geo";
import type {
  LatLng,
  PriceLevel,
  RestaurantDetails,
  RestaurantSummary,
  SearchFilters,
  Style,
} from "@/lib/types";
import { useAccount } from "./AccountProvider";
import { CuisinePicker } from "./CuisinePicker";
import { LocationInput } from "./LocationInput";
import { PlaceActions } from "./PlaceActions";
import { priceText, ResultCard } from "./ResultCard";
import { LocateIcon } from "./icons";
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

// The "slot machine": show random names from the pool for a moment.
async function shuffleNames(pool: { name: string }[], show: (name: string) => void) {
  if (pool.length < 2) return;
  const end = Date.now() + SHUFFLE_MS;
  while (Date.now() < end) {
    show(pool[Math.floor(Math.random() * pool.length)].name);
    await wait(90);
  }
}

// What's showing in one result position: a restaurant, or the dice still rolling.
type Slot = { status: "rolling"; id: string; name: string } | { status: "ready"; id: string; place: RestaurantDetails };

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function Picker() {
  const { couple, saved } = useAccount();

  // Filters
  const [locationText, setLocationText] = useState("");
  // Set when you use GPS or pick a suggestion; typing clears it (then we look up the text).
  const [pickedOrigin, setPickedOrigin] = useState<LatLng | null>(null);
  const [lastOrigin, setLastOrigin] = useState<LatLng | null>(null); // biases suggestions
  const [radius, setRadius] = useState(10);
  const [cuisines, setCuisines] = useState<string[]>([]); // none = any
  const [styles, setStyles] = useState<Style[]>([]); // none = any
  const [prices, setPrices] = useState<PriceLevel[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [openNow, setOpenNow] = useState(false);
  const [includeVisited, setIncludeVisited] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [compare, setCompare] = useState(false);

  // Results
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [keptId, setKeptId] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(0); // which compare card is on screen

  // Kept between rolls (refs, because several rolls can run at once).
  const queue = useRef<RestaurantSummary[]>([]); // shuffled, not yet shown
  const matches = useRef<RestaurantSummary[]>([]); // everything that matched the search
  const origin = useRef<LatLng | null>(null);
  const slotIds = useRef<string[]>([]); // ids on screen, updated instantly
  const carousel = useRef<HTMLDivElement>(null);

  const rolling = slots.some((s) => s.status === "rolling");
  const busy = searching || rolling;
  const moreCount = (minRating > 0 ? 1 : 0) + (openNow ? 1 : 0) + (includeVisited ? 1 : 0);

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

  // Next restaurant from the shuffled queue that isn't already on screen.
  // Reshuffles once everything has been shown.
  function drawNext(exclude: Set<string>): RestaurantSummary | null {
    for (let attempt = 0; attempt < 2; attempt++) {
      const i = queue.current.findIndex((m) => !exclude.has(m.id));
      if (i >= 0) return queue.current.splice(i, 1)[0];
      queue.current = shuffle(matches.current.filter((m) => !exclude.has(m.id)));
    }
    return null;
  }

  function setSlot(index: number, slot: Slot | null) {
    setSlots((prev) => {
      const next = [...prev];
      if (slot) next[index] = slot;
      else next.splice(index, 1);
      return next;
    });
  }

  // Roll a new restaurant into position `index` (0 or 1), with the name-shuffle animation.
  async function rollInto(index: number) {
    const pick = drawNext(new Set(slotIds.current));
    if (!pick) {
      setError(
        matches.current.length <= 1
          ? "That's the only match. Try a bigger radius or fewer filters."
          : "No more matches to show. Try a new search.",
      );
      return;
    }
    slotIds.current[index] = pick.id;
    setRemaining(queue.current.length);
    setSlot(index, { status: "rolling", id: pick.id, name: pick.name });

    const details = getJson<RestaurantDetails>(
      `/api/place?${new URLSearchParams({
        id: pick.id,
        lat: String(origin.current!.lat),
        lng: String(origin.current!.lng),
      })}`,
    );
    details.catch(() => {}); // handled below; stops an early "unhandled" warning

    await shuffleNames(matches.current, (name) => setSlot(index, { status: "rolling", id: pick.id, name }));
    try {
      setSlot(index, { status: "ready", id: pick.id, place: await details });
    } catch (e) {
      slotIds.current.splice(index, 1);
      setSlot(index, null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  // Distance between the start of one compare card and the next.
  function cardStep(el: HTMLElement): number {
    const [a, b] = el.children as unknown as HTMLElement[];
    return b ? b.offsetLeft - a.offsetLeft : el.clientWidth;
  }

  function scrollToCard(index: number, behavior: ScrollBehavior = "smooth") {
    const el = carousel.current;
    if (el) el.scrollTo({ left: index * cardStep(el), behavior });
  }

  // Show a card that just finished rolling. Jumps instantly after the new card
  // has rendered: a smooth scroll gets undone if the card changes size mid-way
  // (e.g. its photo loading), because the browser snaps back to the old card.
  async function revealCard(index: number) {
    await wait(60);
    scrollToCard(index, "instant");
  }

  async function search() {
    setError(null);
    setSearching(true);
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
        styles,
        prices,
        includeUnknownPrice: false,
        minRating,
        openNow,
      };
      const { results, sample } = await getJson<{ results: RestaurantSummary[]; sample: boolean }>(
        "/api/search",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(filters) },
      );
      setSample(sample);
      if (results.length === 0) {
        throw new Error("No restaurants matched. Try a bigger radius or fewer filters.");
      }

      // 3. Leave out places you've hidden, and (unless asked) places you've been.
      const hidden = new Set(saved.filter((s) => s.blocked).map((s) => s.place_id));
      const visited = new Set(saved.filter((s) => s.visitCount > 0).map((s) => s.place_id));
      const pool = results.filter((r) => !hidden.has(r.id) && (includeVisited || !visited.has(r.id)));
      if (pool.length === 0) {
        throw new Error(
          `You've already been to (or hidden) all ${results.length} matches! ` +
            "Turn on “Include places we've been” under More filters, or widen the search.",
        );
      }

      // 4. Shuffle and roll (two at once in compare mode).
      matches.current = pool;
      queue.current = shuffle(pool);
      slotIds.current = [];
      setSlots([]);
      setKeptId(null);
      setVisibleIndex(0);
      carousel.current?.scrollTo({ left: 0 });
      setSearching(false);
      await Promise.all(compare && pool.length > 1 ? [rollInto(0), rollInto(1)] : [rollInto(0)]);
    } catch (e) {
      setSlots([]);
      slotIds.current = [];
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSearching(false);
    }
  }

  // Compare on: keep what's showing and roll a challenger next to it.
  // Compare off: keep the kept (or currently visible) card only.
  function setCompareMode(on: boolean) {
    setCompare(on);
    setError(null);
    if (on && slots.length === 1 && slots[0].status === "ready") {
      rollInto(1).then(() => revealCard(1));
    } else if (!on && slots.length > 1) {
      const keep = slots.find((s) => s.id === keptId) ?? slots[visibleIndex] ?? slots[0];
      slotIds.current = [keep.id];
      setSlots([keep]);
      setKeptId(null);
      setVisibleIndex(0);
    }
  }

  // Replace whichever card isn't kept (or both if neither is).
  async function rollChallenger() {
    setError(null);
    const keptIndex = slots.findIndex((s) => s.id === keptId);
    if (keptIndex === -1) {
      await Promise.all([rollInto(0), rollInto(1)]);
      await revealCard(0);
    } else {
      const other = keptIndex === 0 ? 1 : 0;
      await rollInto(other);
      await revealCard(other);
    }
  }

  // After "Not for us": drop that place for good and roll a replacement.
  function hide(index: number) {
    const id = slots[index]?.id;
    matches.current = matches.current.filter((m) => m.id !== id);
    queue.current = queue.current.filter((m) => m.id !== id);
    if (keptId === id) setKeptId(null);
    if (matches.current.length === slots.length - 1) {
      // Nothing left to replace it with.
      slotIds.current.splice(index, 1);
      setSlot(index, null);
      if (matches.current.length === 0) setError("That was the last match. Try a new search.");
      return;
    }
    rollInto(index);
  }

  const renderSlot = (slot: Slot, index: number) =>
    slot.status === "rolling" ? (
      <div className={`${cardClass} flex min-h-64 flex-col items-center justify-center text-center`}>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          <span className="inline-block animate-spin">🎲</span> Rolling
        </p>
        <p className="mt-2 w-full truncate text-2xl font-semibold text-accent">{slot.name}</p>
      </div>
    ) : (
      <ResultCard
        place={slot.place}
        sample={sample}
        remaining={remaining}
        onReroll={compare ? undefined : () => rollInto(0)}
        keep={compare ? { kept: keptId === slot.id, onToggle: () => setKeptId(keptId === slot.id ? null : slot.id) } : undefined}
      >
        <PlaceActions key={slot.id} place={slot.place} onHidden={() => hide(index)} />
      </ResultCard>
    );

  return (
    <div className="space-y-5">
      <form
        className={`${cardClass} space-y-6`}
        onSubmit={(e) => {
          e.preventDefault();
          search();
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
              onSelect={(place) => {
                setPickedOrigin(place.location);
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

        <div>
          <label htmlFor="cuisine" className={label}>
            Cuisine <span className="font-normal text-muted">· pick one or more</span>
          </label>
          <CuisinePicker selected={cuisines} onChange={setCuisines} />
        </div>

        <fieldset>
          <legend className={label}>
            Style {styles.length === 0 && <span className="font-normal text-muted">· any</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={styles.includes(s.id)}
                onClick={() => setStyles(toggle(styles, s.id))}
                className={chipClass}
              >
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

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
                onClick={() => setPrices(toggle(prices, p).sort())}
                className={`${chipClass} flex-1`}
              >
                {priceText(p)}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore(!showMore)}
            className="flex w-full items-center justify-between text-sm font-medium"
          >
            <span>
              More filters
              {moreCount > 0 && (
                <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{moreCount}</span>
              )}
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className={`h-4 w-4 text-muted transition-transform ${showMore ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z"
              />
            </svg>
          </button>
          {showMore && (
            <div className="mt-4 space-y-5">
              <fieldset>
                <legend className={label}>Minimum rating</legend>
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
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Compare mode</span>
              <span className="block text-xs text-muted">Roll two, swipe between them, keep the winner</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={compare}
              onChange={(e) => setCompareMode(e.target.checked)}
              disabled={busy}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
            />
          </label>
          <button type="submit" disabled={busy} className={`${primaryButton} w-full py-3 text-base`}>
            <span aria-hidden="true" className="text-lg leading-none">🎲</span>
            {busy ? "Rolling…" : compare ? "Roll two to compare" : "Roll the dice"}
          </button>
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      {slots.length === 1 && !compare && renderSlot(slots[0], 0)}

      {compare && slots.length > 0 && (
        <section aria-label="Compare restaurants" className="space-y-3">
          {slots.length > 1 && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => scrollToCard(0)}
                disabled={visibleIndex === 0}
                aria-label="Previous"
                className={`${secondaryButton} px-3 py-1.5 disabled:opacity-30`}
              >
                ‹
              </button>
              <div className="flex items-center gap-2 text-sm text-muted">
                {slots.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => scrollToCard(i)}
                    aria-label={`Show option ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${i === visibleIndex ? "w-6 bg-accent" : "w-2 bg-border"}`}
                  />
                ))}
                <span className="ml-1">Swipe to compare</span>
              </div>
              <button
                type="button"
                onClick={() => scrollToCard(1)}
                disabled={visibleIndex === slots.length - 1}
                aria-label="Next"
                className={`${secondaryButton} px-3 py-1.5 disabled:opacity-30`}
              >
                ›
              </button>
            </div>
          )}

          <div
            ref={carousel}
            onScroll={(e) => {
              const el = e.currentTarget;
              setVisibleIndex(Math.round(el.scrollLeft / cardStep(el)));
            }}
            className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slots.map((slot, i) => (
              <div key={i} className="w-full shrink-0 snap-start">
                {renderSlot(slot, i)}
              </div>
            ))}
          </div>

          {slots.length > 1 && (
            <button type="button" onClick={rollChallenger} disabled={busy} className={`${primaryButton} w-full`}>
              <span aria-hidden="true">🎲</span>
              {keptId ? "Roll a challenger" : "Re-roll both"}
            </button>
          )}
          {slots.length > 1 && !keptId && (
            <p className="text-center text-xs text-muted">Tap &ldquo;Keep&rdquo; on your favorite to roll a challenger against it.</p>
          )}
        </section>
      )}
    </div>
  );
}
