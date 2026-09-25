"use client";

import { useEffect, useState } from "react";
import { deleteVisit, listVisits, placeInfoFromSearch, type PlaceInfo, type Visit } from "@/lib/db";
import { useAccount } from "./AccountProvider";
import { LocationInput } from "./LocationInput";
import { priceText } from "./ResultCard";
import { UtensilsIcon } from "./icons";
import { cardClass, ErrorText, errorMessage, formatDate, primaryButton, secondaryButton } from "./ui";
import { VisitForm } from "./VisitForm";

// Search for any restaurant and log a visit to it.
function LogVisit() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setText("");
    setPlace(null);
    setError(null);
  }

  if (!open) {
    return (
      <button className={`${primaryButton} w-full`} onClick={() => setOpen(true)}>
        + Log a restaurant you went to
      </button>
    );
  }

  return (
    <div className={`${cardClass} space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Log a visit</h2>
        <button className="text-sm text-muted hover:text-foreground" onClick={close}>
          Cancel
        </button>
      </div>
      {place ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{place.name}</p>
              <p className="truncate text-sm text-muted">
                {[place.cuisine_label, priceText(place.price ?? undefined), place.address].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button
              className={`${secondaryButton} shrink-0 px-2.5 py-1.5 text-sm`}
              onClick={() => {
                setPlace(null);
                setText("");
              }}
            >
              Change
            </button>
          </div>
          <VisitForm mode="new" place={place} onDone={close} />
        </>
      ) : (
        <>
          <label htmlFor="log-search" className="sr-only">
            Restaurant name
          </label>
          <LocationInput
            id="log-search"
            kind="food"
            placeholder="Search restaurants, cafés, bars…"
            value={text}
            onChange={setText}
            onSelect={(p) => p.restaurant && setPlace(placeInfoFromSearch(p.restaurant))}
            onError={setError}
            near={null}
          />
          <p className="text-xs text-muted">Start typing the name, then pick it from the list.</p>
          <ErrorText>{error}</ErrorText>
        </>
      )}
    </div>
  );
}

// "Been there": every visit, newest first, with each person's rating.
export function History() {
  const { couple, user, saved, reloadSaved } = useAccount();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [rating, setRating] = useState<string | null>(null); // visit id being rated
  const [error, setError] = useState<string | null>(null);

  // Load visits, and reload whenever saved places change (e.g. after logging a visit).
  useEffect(() => {
    if (!couple) return;
    let stale = false;
    listVisits(couple.id)
      .then((v) => !stale && setVisits(v))
      .catch((e) => !stale && setError(errorMessage(e)));
    return () => {
      stale = true;
    };
  }, [couple, saved]);

  async function remove(v: Visit) {
    if (!confirm(`Delete your ${formatDate(v.visited_on)} visit to ${v.place.name}?`)) return;
    try {
      await deleteVisit(v.id);
      await reloadSaved();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!couple || !user) return null;
  const nameOf = (id: string) =>
    id === user.id ? "You" : (couple.members.find((m) => m.user_id === id)?.display_name ?? "Partner");

  return (
    <div className="space-y-4">
      <LogVisit />
      <ErrorText>{error}</ErrorText>

      {!visits ? (
        <p className="text-center text-muted">Loading…</p>
      ) : visits.length === 0 ? (
        <div className={`${cardClass} text-center`}>
          <UtensilsIcon className="mx-auto h-8 w-8 text-muted/60" />
          <p className="mt-3 font-medium">No visits yet</p>
          <p className="mt-1 text-sm text-muted">
            Roll for a restaurant and tap &ldquo;We went&rdquo;, or log any place above.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visits.map((v) => {
            const avg = v.ratings.reduce((sum, r) => sum + r.stars, 0) / (v.ratings.length || 1);
            const mine = v.ratings.find((r) => r.user_id === user.id);
            return (
              <li key={v.id} className={cardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">{v.place.name}</h3>
                    <p className="text-sm text-muted">
                      {[formatDate(v.visited_on), v.place.cuisine_label, priceText(v.place.price ?? undefined)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {v.ratings.length > 0 && (
                    <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-sm font-medium">
                      <span className="text-star">★</span> {avg.toFixed(1)}
                    </span>
                  )}
                </div>

                <ul className="mt-3 space-y-1.5 text-sm">
                  {v.ratings.map((r) => (
                    <li key={r.user_id}>
                      <span className="font-medium">{nameOf(r.user_id)}:</span>{" "}
                      <span className="text-star">{"★".repeat(r.stars)}</span>
                      <span className="text-border">{"★".repeat(5 - r.stars)}</span>
                      {r.note && <span className="text-muted"> &ldquo;{r.note}&rdquo;</span>}
                    </li>
                  ))}
                </ul>

                {rating === v.id ? (
                  <div className="mt-3">
                    <VisitForm
                      mode="rate"
                      visitId={v.id}
                      initial={mine ? { stars: mine.stars, note: mine.note } : undefined}
                      onDone={() => setRating(null)}
                    />
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <button className="font-medium text-accent" onClick={() => setRating(v.id)}>
                      {mine ? "Edit your rating" : "+ Add your rating"}
                    </button>
                    {v.place.maps_url && (
                      <a href={v.place.maps_url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground">
                        Maps
                      </a>
                    )}
                    <button className="text-muted hover:text-foreground" onClick={() => remove(v)}>
                      Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
