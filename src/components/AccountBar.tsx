"use client";

import { useState } from "react";
import { useAccount } from "./AccountProvider";
import { CoupleSetup } from "./CoupleSetup";
import { SignIn } from "./SignIn";
import { cardClass } from "./ui";

// Sign-in prompt, couple setup, or a "You & partner" line, depending on state.
export function AccountBar() {
  const { enabled, loading, user, couple, signOut } = useAccount();
  const [signingIn, setSigningIn] = useState(false);

  if (!enabled || loading) return null;

  if (!user) {
    return (
      <div className={cardClass}>
        {signingIn ? (
          <SignIn onCancel={() => setSigningIn(false)} />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">Sign in to keep a shared history of where you&rsquo;ve been.</p>
            <button
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setSigningIn(true)}
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!couple) {
    return (
      <div className={cardClass}>
        <h2 className="mb-3 text-lg font-bold">Set up your shared list</h2>
        <CoupleSetup />
      </div>
    );
  }

  const partner = couple.members.find((m) => m.user_id !== user.id);
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-sm">
      {partner ? (
        <span>
          👫 You &amp; <strong>{partner.display_name}</strong>
        </span>
      ) : (
        <span>
          Invite your partner with code{" "}
          <strong className="rounded bg-card px-1.5 py-0.5 tracking-widest ring-1 ring-black/10 select-all">
            {couple.invite_code}
          </strong>
        </span>
      )}
      <button className="shrink-0 text-muted underline" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
