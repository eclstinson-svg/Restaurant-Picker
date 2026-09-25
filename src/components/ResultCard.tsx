import type { RestaurantDetails } from "@/lib/types";
import { GlobeIcon, MapPinIcon, ShuffleIcon, UtensilsIcon } from "./icons";
import { primaryButton, secondaryButton } from "./ui";

export function priceText(price?: number) {
  return price ? "$".repeat(price) : "";
}

export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="tracking-tight" aria-label={`${rating} out of 5 stars`}>
      <span className="text-star">{"★".repeat(full)}</span>
      <span className="text-border">{"★".repeat(5 - full)}</span>
    </span>
  );
}

type Props = {
  place: RestaurantDetails;
  sample: boolean;
  onReroll: () => void;
  remaining: number;
  children?: React.ReactNode; // extra actions (e.g. "We went here") when signed in
};

export function ResultCard({ place, sample, onReroll, remaining, children }: Props) {
  const meta = [place.cuisineLabel, priceText(place.price), `${place.distanceMiles.toFixed(1)} mi`].filter(
    Boolean,
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-[pop_250ms_ease-out]">
      <div className="relative aspect-[16/9] bg-subtle">
        {place.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo comes via our own redirecting API route
          <img src={place.photoUrl} alt={place.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted/60">
            <UtensilsIcon className="h-14 w-14" />
          </div>
        )}
        {place.photoCredit && (
          <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
            Photo: {place.photoCredit}
          </span>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Your pick</p>
          <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight">{place.name}</h2>
          <p className="mt-1 text-sm text-muted">{meta.join(" · ")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {place.rating !== undefined && (
            <span className="flex items-center gap-1.5">
              <Stars rating={place.rating} />
              <span className="font-medium">{place.rating.toFixed(1)}</span>
              <span className="text-muted">({place.ratingCount?.toLocaleString()})</span>
            </span>
          )}
          {place.openNow !== undefined && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                place.openNow
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
              }`}
            >
              {place.openNow ? "Open now" : "Closed now"}
            </span>
          )}
        </div>

        {place.summary && <p className="leading-relaxed">{place.summary}</p>}

        <p className="flex items-start gap-1.5 text-sm text-muted">
          <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {place.address}
            {place.phone && <> · {place.phone}</>}
          </span>
        </p>

        {place.reviews.length > 0 && (
          <div className="space-y-2.5 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Recent reviews</h3>
            {place.reviews.map((r, i) => (
              <blockquote key={i} className="rounded-lg bg-subtle p-3 text-sm">
                <p className="line-clamp-4 leading-relaxed">{r.text}</p>
                <footer className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                  <span className="text-star">{"★".repeat(Math.round(r.rating))}</span>
                  <span>
                    {r.author} · {r.when}
                  </span>
                </footer>
              </blockquote>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <a href={place.googleMapsUrl} target="_blank" rel="noopener noreferrer" className={`${primaryButton} flex-1`}>
            <MapPinIcon />
            Directions
          </a>
          {place.website && (
            <a href={place.website} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
              <GlobeIcon />
              Website
            </a>
          )}
          <button onClick={onReroll} className={secondaryButton}>
            <ShuffleIcon />
            Re-roll
          </button>
        </div>

        {children}

        <p className="text-center text-xs text-muted">
          {remaining > 0
            ? `${remaining} more match${remaining === 1 ? "" : "es"} left`
            : "That was the last match. Re-roll to reshuffle."}
          {" · "}
          {sample ? "Sample data" : "Data from Google Maps"}
        </p>
      </div>
    </article>
  );
}
