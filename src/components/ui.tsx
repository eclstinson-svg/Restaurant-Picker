"use client";

// Small shared pieces of UI and styling used across screens.

export const labelClass = "block text-sm font-medium mb-1.5";
export const fieldClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-3 focus:ring-accent/15";
export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 font-medium transition-colors hover:bg-subtle disabled:opacity-60";
export const cardClass = "rounded-2xl border border-border bg-card p-5 shadow-sm shadow-slate-900/[0.03]";
// Toggle chip (use with aria-pressed): outlined when off, soft teal when on.
export const chipClass =
  "rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-subtle aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent";

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
      {children}
    </p>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className={`text-3xl leading-none transition-transform active:scale-90 ${
            n <= value ? "text-star" : "text-border"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function today(): string {
  // Local date as YYYY-MM-DD (toISOString would use UTC and can be off by a day).
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
