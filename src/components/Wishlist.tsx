"use client";

import { useState } from "react";
import { setFlags, type SavedPlace } from "@/lib/db";
import { useAccount } from "./AccountProvider";
import { priceText } from "./ResultCard";
import { BookmarkIcon } from "./icons";
import { cardClass, ErrorText, errorMessage } from "./ui";
import { VisitForm } from "./VisitForm";

// "Want to try": the shared wishlist, plus places you've hidden.
export function Wishlist() {
  const { saved, reloadSaved } = useAccount();
  const [logging, setLogging] = useState<string | null>(null); // saved place id
  const [error, setError] = useState<string | null>(null);

  const wishlist = saved.filter((s) => s.wishlist && !s.blocked);
  const hidden = saved.filter((s) => s.blocked);

  async function update(s: SavedPlace, flags: { wishlist?: boolean; blocked?: boolean }) {
    try {
      await setFlags(s.id, flags);
      await reloadSaved();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <ErrorText>{error}</ErrorText>

      {wishlist.length === 0 ? (
        <div className={`${cardClass} text-center`}>
          <BookmarkIcon className="mx-auto h-8 w-8 text-muted/60" />
          <p className="mt-3 font-medium">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted">
            When a pick looks good but not tonight, tap &ldquo;Save&rdquo; to keep it here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {wishlist.map((s) => (
            <li key={s.id} className={cardClass}>
              <h3 className="text-lg font-semibold">{s.name}</h3>
              <p className="text-sm text-muted">
                {[s.cuisine_label, priceText(s.price ?? undefined), s.address].filter(Boolean).join(" · ")}
              </p>
              {logging === s.id ? (
                <div className="mt-3">
                  <VisitForm mode="new" place={s} onDone={() => setLogging(null)} />
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <button className="font-medium text-accent" onClick={() => setLogging(s.id)}>
                    We went
                  </button>
                  {s.maps_url && (
                    <a href={s.maps_url} target="_blank" rel="noopener noreferrer" className="text-muted underline">
                      Maps
                    </a>
                  )}
                  <button className="text-muted underline" onClick={() => update(s, { wishlist: false })}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {hidden.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">
            Hidden places ({hidden.length}), never picked again
          </summary>
          <ul className="mt-2 space-y-1">
            {hidden.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
                <span className="truncate">{s.name}</span>
                <button className="shrink-0 text-accent" onClick={() => update(s, { blocked: false })}>
                  Unhide
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
