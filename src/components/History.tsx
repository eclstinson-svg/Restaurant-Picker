"use client";

import { useEffect, useState } from "react";
import { deleteVisit, listVisits, type Visit } from "@/lib/db";
import { useAccount } from "./AccountProvider";
import { priceText } from "./ResultCard";
import { cardClass, ErrorText, errorMessage, formatDate } from "./ui";
import { VisitForm } from "./VisitForm";

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

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!visits) return <p className="text-center text-muted">Loading…</p>;
  if (visits.length === 0) {
    return (
      <div className={`${cardClass} text-center`}>
        <p className="text-4xl">🍽️</p>
        <p className="mt-2 font-semibold">No visits yet</p>
        <p className="text-sm text-muted">
          Pick a restaurant, go eat, then tap &ldquo;We went here&rdquo; to log it.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {visits.map((v) => {
        const avg = v.ratings.reduce((sum, r) => sum + r.stars, 0) / (v.ratings.length || 1);
        const iRated = v.ratings.some((r) => r.user_id === user.id);
        return (
          <li key={v.id} className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold">{v.place.name}</h3>
                <p className="text-sm text-muted">
                  {[formatDate(v.visited_on), v.place.cuisine_label, priceText(v.place.price ?? undefined)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {v.ratings.length > 0 && (
                <span className="shrink-0 rounded-full bg-subtle px-2.5 py-1 text-sm font-bold">
                  <span className="text-amber-500">★</span> {avg.toFixed(1)}
                </span>
              )}
            </div>

            <ul className="mt-3 space-y-1.5 text-sm">
              {v.ratings.map((r) => (
                <li key={r.user_id}>
                  <span className="font-semibold">{nameOf(r.user_id)}:</span>{" "}
                  <span className="text-amber-500">{"★".repeat(r.stars)}</span>
                  {r.note && <span className="text-muted"> &ldquo;{r.note}&rdquo;</span>}
                </li>
              ))}
            </ul>

            {rating === v.id ? (
              <div className="mt-3">
                <VisitForm mode="rate" visitId={v.id} onDone={() => setRating(null)} />
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {!iRated && (
                  <button className="font-semibold text-accent" onClick={() => setRating(v.id)}>
                    + Add your rating
                  </button>
                )}
                {v.place.maps_url && (
                  <a href={v.place.maps_url} target="_blank" rel="noopener noreferrer" className="text-muted underline">
                    Maps
                  </a>
                )}
                <button className="text-muted underline" onClick={() => remove(v)}>
                  Delete
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
