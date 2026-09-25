"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CUISINES, cuisineLabel, POPULAR_CUISINES } from "@/lib/cuisines";
import { CheckIcon } from "./icons";
import { fieldClass } from "./ui";

type Props = {
  selected: string[]; // empty = any cuisine
  onChange: (types: string[]) => void;
};

// One compact field that opens a searchable checklist of cuisines.
export function CuisinePicker({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  // Close when tapping outside or pressing Esc.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(type: string) {
    onChange(selected.includes(type) ? selected.filter((t) => t !== type) : [...selected, type]);
  }

  function openPanel() {
    setQuery("");
    setOpen(true);
    // Focus the search box on larger screens; on phones this would pop the keyboard over the list.
    if (window.matchMedia("(min-width: 640px)").matches) setTimeout(() => search.current?.focus(), 0);
  }

  const q = query.trim().toLowerCase();
  const matches = CUISINES.filter((c) => c.label.toLowerCase().includes(q));
  const popular = q ? [] : matches.filter((c) => POPULAR_CUISINES.includes(c.type));
  const rest = (q ? matches : matches.filter((c) => !POPULAR_CUISINES.includes(c.type))).sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  // "Thai, Sushi +2"
  const labels = selected.map(cuisineLabel);
  const summary =
    labels.length === 0 ? "Any cuisine" : labels.slice(0, 2).join(", ") + (labels.length > 2 ? ` +${labels.length - 2}` : "");

  const option = (c: (typeof CUISINES)[number]) => {
    const checked = selected.includes(c.type);
    return (
      <li key={c.type}>
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={checked}
          onClick={() => toggle(c.type)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-subtle"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
              checked ? "border-accent bg-accent text-accent-fg" : "border-border"
            }`}
          >
            {checked && <CheckIcon className="h-3.5 w-3.5" />}
          </span>
          {c.label}
        </button>
      </li>
    );
  };

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        id="cuisine"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected.length === 0 ? "text-muted" : ""}`}>{summary}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-slate-900/10"
        >
          <div className="border-b border-border p-2">
            <input
              ref={search}
              type="search"
              aria-label="Search cuisines"
              placeholder="Search cuisines…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg bg-subtle px-3 py-2 text-sm outline-none placeholder:text-muted"
            />
          </div>

          <ul role="menu" className="max-h-72 overflow-auto py-1 text-sm">
            {!q && (
              <li>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected.length === 0}
                  onClick={() => onChange([])}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left font-medium hover:bg-subtle"
                >
                  Any cuisine
                  {selected.length === 0 && <CheckIcon className="h-4 w-4 text-accent" />}
                </button>
              </li>
            )}
            {popular.length > 0 && (
              <li className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted">Popular</li>
            )}
            {popular.map(option)}
            {rest.length > 0 && !q && (
              <li className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted">More</li>
            )}
            {rest.map(option)}
            {matches.length === 0 && <li className="px-3 py-4 text-center text-muted">No cuisines match &ldquo;{query}&rdquo;</li>}
          </ul>

          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="text-sm text-muted hover:text-foreground disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
            >
              Done{selected.length > 0 ? ` (${selected.length})` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
