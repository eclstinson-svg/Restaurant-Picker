"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ErrorText, errorMessage, fieldClass, labelClass, primaryButton, secondaryButton } from "./ui";

// Email + password sign-in. New accounts confirm their email once via the
// link Supabase sends; after that, signing in never needs email again.
export function SignIn({ onCancel }: { onCancel: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase!.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is on: they need to click the link first.
          setNotice(
            `Almost done! We emailed a confirmation link to ${email.trim()}. ` +
              "Click it, then come back here and sign in.",
          );
          setMode("signin");
        }
      } else {
        const { error } = await supabase!.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (/not confirmed/i.test(error.message)) {
            throw new Error("Please click the confirmation link we emailed you first.");
          }
          if (/invalid login/i.test(error.message)) {
            throw new Error("Wrong email or password.");
          }
          throw error;
        }
      }
      // On success, AccountProvider notices the new session and moves on.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="text-lg font-bold">{mode === "signin" ? "Sign in" : "Create your account"}</h2>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className={fieldClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Password {mode === "signup" && <span className="font-normal text-muted">(at least 8 characters)</span>}
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className={fieldClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {notice && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {notice}
        </p>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className={`${primaryButton} flex-1`} disabled={busy}>
          {busy ? "One sec…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className={secondaryButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <button
        type="button"
        className="text-sm text-accent underline"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setNotice(null);
        }}
      >
        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
