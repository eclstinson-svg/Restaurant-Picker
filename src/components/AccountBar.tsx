"use client";

import { useState } from "react";
import { useAccount } from "./AccountProvider";
import { CoupleSetup } from "./CoupleSetup";
import { SignIn } from "./SignIn";
import { cardClass, secondaryButton } from "./ui";

function Initial({ name }: { name?: string }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-accent-soft text-xs font-semibold text-accent">
      {name?.[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

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
            <button className={`${secondaryButton} shrink-0 py-2 text-sm`} onClick={() => setSigningIn(true)}>
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
        <h2 className="mb-3 text-lg font-semibold">Set up your shared list</h2>
        <CoupleSetup />
      </div>
    );
  }

  const me = couple.members.find((m) => m.user_id === user.id);
  const partner = couple.members.find((m) => m.user_id !== user.id);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      {partner ? (
        <span className="flex items-center gap-2.5">
          <span className="flex -space-x-1.5">
            <Initial name={me?.display_name} />
            <Initial name={partner.display_name} />
          </span>
          <span className="text-muted">
            You &amp; <span className="font-medium text-foreground">{partner.display_name}</span>
          </span>
        </span>
      ) : (
        <span className="text-muted">
          Invite your partner with code{" "}
          <strong className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono tracking-widest text-foreground select-all">
            {couple.invite_code}
          </strong>
        </span>
      )}
      <button className="shrink-0 text-muted hover:text-foreground" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
