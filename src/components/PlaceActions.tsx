"use client";

import { useState } from "react";
import { placeInfoFrom, savePlace, setFlags } from "@/lib/db";
import type { RestaurantDetails } from "@/lib/types";
import { useAccount } from "./AccountProvider";
import { ErrorText, errorMessage, secondaryButton } from "./ui";
import { VisitForm } from "./VisitForm";

// "We went" / "Want to try" / "Not for us" buttons under a picked restaurant.
// Only shown once you're signed in and in a couple.
export function PlaceActions({
  place,
  onHidden,
}: {
  place: RestaurantDetails;
  onHidden: () => void;
}) {
  const { couple, saved, reloadSaved } = useAccount();
  const [logging, setLogging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState(false);

  if (!couple) return null;
  const entry = saved.find((s) => s.place_id === place.id);

  async function update(flags: { wishlist?: boolean; blocked?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      if (entry) await setFlags(entry.id, flags);
      else await savePlace(couple!.id, placeInfoFrom(place), flags);
      await reloadSaved();
      if (flags.blocked) onHidden();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (logging) {
    return (
      <VisitForm
        mode="new"
        place={placeInfoFrom(place)}
        onDone={() => {
          setLogging(false);
          setJustLogged(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {(entry?.visitCount ?? 0) > 0 && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {justLogged ? "Saved! " : ""}You&rsquo;ve been here {entry!.visitCount}{" "}
          {entry!.visitCount === 1 ? "time" : "times"}.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button className={secondaryButton} disabled={busy} onClick={() => setLogging(true)}>
          ✓ We went here
        </button>
        <button
          className={secondaryButton}
          disabled={busy}
          aria-pressed={entry?.wishlist ?? false}
          onClick={() => update({ wishlist: !entry?.wishlist })}
        >
          {entry?.wishlist ? "★ On our list" : "☆ Want to try"}
        </button>
        <button className={secondaryButton} disabled={busy} onClick={() => update({ blocked: true })}>
          🚫 Not for us
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
