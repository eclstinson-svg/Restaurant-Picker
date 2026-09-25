"use client";

// Small shared pieces of UI and styling used across screens.

export const labelClass = "block text-sm font-semibold mb-1.5";
export const fieldClass =
  "w-full rounded-xl bg-card px-3.5 py-3 ring-1 ring-black/10 dark:ring-white/15 focus:outline-none focus:ring-2 focus:ring-accent";
export const primaryButton =
  "rounded-full bg-accent px-5 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60";
export const secondaryButton =
  "rounded-full px-4 py-2.5 font-semibold ring-1 ring-current/20 hover:bg-subtle disabled:opacity-60";
export const cardClass = "rounded-3xl bg-card p-5 shadow-sm ring-1 ring-black/5";

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
            n <= value ? "text-amber-500" : "text-stone-300 dark:text-stone-600"
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
