"use client";

import { useState } from "react";
import { createCouple, joinCouple } from "@/lib/db";
import { useAccount } from "./AccountProvider";
import { ErrorText, errorMessage, fieldClass, labelClass, primaryButton, secondaryButton } from "./ui";

// Shown after sign-in if you're not in a couple yet.
export function CoupleSetup() {
  const { reloadCouple, signOut } = useAccount();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    if (!name.trim()) {
      setError("Enter your first name first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await action();
      await reloadCouple();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="myname" className={labelClass}>
          Your first name
        </label>
        <input
          id="myname"
          className={fieldClass}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Evan"
        />
      </div>

      <button
        className={`${primaryButton} w-full`}
        disabled={busy}
        onClick={() => run(() => createCouple(name))}
      >
        Start our shared list
      </button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" /> or join your partner <span className="h-px flex-1 bg-border" />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => joinCouple(code, name));
        }}
      >
        <input
          aria-label="Invite code"
          className={`${fieldClass} uppercase tracking-widest`}
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="INVITE CODE"
        />
        <button className={secondaryButton} disabled={busy || code.length < 6}>
          Join
        </button>
      </form>

      <ErrorText>{error}</ErrorText>

      <button className="text-xs text-muted underline" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
