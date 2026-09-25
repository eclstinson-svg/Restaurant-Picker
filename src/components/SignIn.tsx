"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ErrorText, errorMessage, fieldClass, labelClass, primaryButton, secondaryButton } from "./ui";

// Sign in with a code sent by email. A code (rather than a clickable link)
// works even when the app is installed on a phone's home screen, where
// email links would open in a different browser.
export function SignIn({ onCancel }: { onCancel: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase!.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase!.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      // AccountProvider notices the new session and moves on to couple setup.
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (!sent) {
    return (
      <form onSubmit={sendCode} className="space-y-3">
        <label htmlFor="email" className={labelClass}>
          Your email
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
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <button className={`${primaryButton} flex-1`} disabled={busy}>
            {busy ? "Sending…" : "Email me a sign-in code"}
          </button>
          <button type="button" className={secondaryButton} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-3">
      <label htmlFor="code" className={labelClass}>
        Enter the code we sent to {email}
      </label>
      <input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        pattern="[0-9]{6,10}"
        className={`${fieldClass} text-center text-2xl tracking-[0.4em]`}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="••••••"
      />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className={`${primaryButton} flex-1`} disabled={busy}>
          {busy ? "Checking…" : "Sign in"}
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            setSent(false);
            setCode("");
            setError(null);
          }}
        >
          Back
        </button>
      </div>
    </form>
  );
}
