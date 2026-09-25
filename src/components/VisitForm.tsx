"use client";

import { useState } from "react";
import { logVisit, rateVisit, type PlaceInfo } from "@/lib/db";
import { useAccount } from "./AccountProvider";
import {
  ErrorText,
  errorMessage,
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
  StarInput,
  today,
} from "./ui";

type Props =
  | { mode: "new"; place: PlaceInfo; onDone: () => void } // log a new visit
  | { mode: "rate"; visitId: string; onDone: () => void }; // add my rating to an existing visit

export function VisitForm(props: Props) {
  const { couple, user, reloadSaved } = useAccount();
  const [date, setDate] = useState(today());
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!couple || !user) return;
    if (stars === 0) {
      setError("Tap the stars to rate it.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (props.mode === "new") {
        await logVisit(couple.id, props.place, date, user.id, stars, note);
      } else {
        await rateVisit(props.visitId, user.id, stars, note);
      }
      await reloadSaved();
      props.onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl bg-subtle p-4">
      {props.mode === "new" && (
        <div>
          <label htmlFor="visit-date" className={labelClass}>
            When did you go?
          </label>
          <input
            id="visit-date"
            type="date"
            max={today()}
            className={fieldClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      )}
      <div>
        <span className={labelClass}>Your rating</span>
        <StarInput value={stars} onChange={setStars} />
      </div>
      <div>
        <label htmlFor="visit-note" className={labelClass}>
          Notes <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="visit-note"
          rows={2}
          maxLength={500}
          className={fieldClass}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you order? Would you go back?"
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className={`${primaryButton} flex-1`} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className={secondaryButton} onClick={props.onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
