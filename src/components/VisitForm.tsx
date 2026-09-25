"use client";

import { useState } from "react";
import { logVisit, photosEnabled, rateVisit, uploadVisitPhotos, type NewRating, type PlaceInfo } from "@/lib/db";
import { useAccount } from "./AccountProvider";
import { PhotoPicker } from "./Photos";
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
  | {
      mode: "rate"; // add or edit my rating on an existing visit
      visitId: string;
      initial?: { stars: number; note: string | null };
      onDone: () => void;
    };

// Stars + comment for one person.
function RatingFields({
  who,
  stars,
  note,
  onStars,
  onNote,
  idPrefix,
}: {
  who: string;
  stars: number;
  note: string;
  onStars: (n: number) => void;
  onNote: (s: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <span className={labelClass}>{who}</span>
      <StarInput value={stars} onChange={onStars} />
      <textarea
        id={`${idPrefix}-note`}
        aria-label={`${who} comments`}
        rows={2}
        maxLength={500}
        className={fieldClass}
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Comments: what you ordered, would you go back…"
      />
    </div>
  );
}

export function VisitForm(props: Props) {
  const { couple, user, reloadSaved } = useAccount();
  const partner = couple?.members.find((m) => m.user_id !== user?.id);
  const initial = props.mode === "rate" ? props.initial : undefined;

  const [date, setDate] = useState(today());
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");
  const [ratePartner, setRatePartner] = useState(false);
  const [partnerStars, setPartnerStars] = useState(0);
  const [partnerNote, setPartnerNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!couple || !user) return;
    if (stars === 0) {
      setError("Tap the stars to add your rating.");
      return;
    }
    if (ratePartner && partnerStars === 0) {
      setError(`Tap the stars for ${partner?.display_name}'s rating, or remove it.`);
      return;
    }
    setBusy(true);
    setError(null);
    let visitId: string;
    try {
      if (props.mode === "new") {
        const ratings: NewRating[] = [{ user_id: user.id, stars, note }];
        if (ratePartner && partner) {
          ratings.push({ user_id: partner.user_id, stars: partnerStars, note: partnerNote });
        }
        visitId = await logVisit(couple.id, props.place, date, ratings);
      } else {
        visitId = props.visitId;
        await rateVisit(visitId, user.id, stars, note);
      }
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
      return;
    }
    // The visit is saved at this point; a photo problem shouldn't lose it.
    if (photos.length > 0) {
      setUploading(true);
      try {
        await uploadVisitPhotos(couple.id, visitId, photos);
      } catch (e) {
        alert(`Your visit was saved, but some photos didn't upload: ${errorMessage(e)} You can add them from the visit in "Been there".`);
      }
    }
    await reloadSaved();
    props.onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-border bg-subtle p-4">
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

      <RatingFields
        who="Your rating"
        idPrefix="me"
        stars={stars}
        note={note}
        onStars={setStars}
        onNote={setNote}
      />

      {props.mode === "new" && partner && (
        ratePartner ? (
          <div className="space-y-2 border-t border-border pt-4">
            <RatingFields
              who={`${partner.display_name}'s rating`}
              idPrefix="partner"
              stars={partnerStars}
              note={partnerNote}
              onStars={setPartnerStars}
              onNote={setPartnerNote}
            />
            <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setRatePartner(false)}>
              Remove {partner.display_name}&rsquo;s rating ({partner.display_name} can add it later)
            </button>
          </div>
        ) : (
          <button type="button" className="text-sm font-medium text-accent" onClick={() => setRatePartner(true)}>
            + Add {partner.display_name}&rsquo;s rating too
          </button>
        )
      )}

      {photosEnabled && (
        <div className="space-y-2 border-t border-border pt-4">
          <span className={labelClass}>
            Photos <span className="font-normal text-muted">(optional)</span>
          </span>
          <PhotoPicker files={photos} onChange={setPhotos} />
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className={`${primaryButton} flex-1`} disabled={busy}>
          {uploading ? `Uploading ${photos.length} photo${photos.length === 1 ? "" : "s"}…` : busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className={secondaryButton} onClick={props.onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
