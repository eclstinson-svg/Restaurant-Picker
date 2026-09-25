import type { RestaurantDetails } from "@/lib/types";

export function priceText(price?: number) {
  return price ? "$".repeat(price) : "";
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(full)}
      <span className="text-stone-300 dark:text-stone-600">{"★".repeat(5 - full)}</span>
    </span>
  );
}

type Props = {
  place: RestaurantDetails;
  sample: boolean;
  onReroll: () => void;
  remaining: number;
};

export function ResultCard({ place, sample, onReroll, remaining }: Props) {
  const meta = [
    place.cuisineLabel,
    priceText(place.price),
    `${place.distanceMiles.toFixed(1)} mi away`,
  ].filter(Boolean);

  return (
    <article className="overflow-hidden rounded-3xl bg-card shadow-xl ring-1 ring-black/5 animate-[pop_300ms_ease-out]">
      <div className="relative h-52 bg-gradient-to-br from-accent to-amber-500">
        {place.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo comes via our own redirecting API route
          <img src={place.photoUrl} alt={place.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-7xl">🍽️</div>
        )}
        {place.photoCredit && (
          <span className="absolute bottom-2 right-3 rounded bg-black/50 px-1.5 text-[10px] text-white">
            Photo: {place.photoCredit}
          </span>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Tonight you&rsquo;re going to…
          </p>
          <h2 className="mt-1 text-2xl font-bold leading-tight">{place.name}</h2>
          <p className="mt-1 text-sm text-muted">{meta.join(" · ")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {place.rating !== undefined && (
            <span className="flex items-center gap-1.5">
              <Stars rating={place.rating} />
              <strong>{place.rating.toFixed(1)}</strong>
              <span className="text-muted">({place.ratingCount?.toLocaleString()} reviews)</span>
            </span>
          )}
          {place.openNow !== undefined && (
            <span
              className={
                place.openNow
                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                  : "font-medium text-rose-600 dark:text-rose-400"
              }
            >
              {place.openNow ? "Open now" : "Closed now"}
            </span>
          )}
        </div>

        {place.summary && <p className="text-[15px] leading-relaxed">{place.summary}</p>}

        <p className="text-sm text-muted">
          {place.address}
          {place.phone && <> · {place.phone}</>}
        </p>

        {place.reviews.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">What people say</h3>
            {place.reviews.map((r, i) => (
              <blockquote key={i} className="rounded-xl bg-subtle p-3 text-sm">
                <p className="line-clamp-4 leading-relaxed">&ldquo;{r.text}&rdquo;</p>
                <footer className="mt-1.5 text-xs text-muted">
                  {"★".repeat(Math.round(r.rating))} · {r.author} · {r.when}
                </footer>
              </blockquote>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={place.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-full bg-accent px-4 py-3 text-center font-semibold text-white hover:opacity-90"
          >
            Open in Google Maps
          </a>
          {place.website && (
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-4 py-3 font-semibold ring-1 ring-current/20 hover:bg-subtle"
            >
              Website
            </a>
          )}
          <button
            onClick={onReroll}
            className="rounded-full px-4 py-3 font-semibold ring-1 ring-current/20 hover:bg-subtle"
          >
            🎲 Re-roll
          </button>
        </div>

        <p className="text-center text-xs text-muted">
          {remaining > 0
            ? `${remaining} more match${remaining === 1 ? "" : "es"} in the hat`
            : "That was the last match. Re-roll reshuffles them."}
          {" · "}
          {sample ? "Sample data (no Google key yet)" : "Info & reviews from Google Maps"}
        </p>
      </div>
    </article>
  );
}
