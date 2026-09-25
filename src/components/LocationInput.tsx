"use client";

import { useId, useRef, useState } from "react";
import type { LatLng, Suggestion } from "@/lib/types";
import { fieldClass } from "./ui";

type Props = {
  value: string;
  onChange: (text: string) => void; // typing (clears any previously chosen place)
  onSelect: (location: LatLng) => void; // a suggestion was chosen
  onError: (message: string) => void;
  near: LatLng | null; // bias suggestions toward here
};

// A text box that suggests addresses, businesses, parks, etc. as you type.
export function LocationInput({ value, onChange, onSelect, onError, near }: Props) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // highlighted row for keyboard use
  const [resolving, setResolving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestRequest = useRef(0);
  const session = useRef<string | null>(null);

  function handleChange(text: string) {
    onChange(text);
    clearTimeout(timer.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    // Wait until typing pauses briefly, so we don't call Google on every keystroke.
    timer.current = setTimeout(async () => {
      session.current ??= crypto.randomUUID();
      const requestId = ++latestRequest.current;
      const params = new URLSearchParams({ q: text, session: session.current });
      if (near) {
        params.set("lat", String(near.lat));
        params.set("lng", String(near.lng));
      }
      try {
        const res = await fetch(`/api/autocomplete?${params}`);
        const data = await res.json();
        if (requestId !== latestRequest.current) return; // a newer request is on its way
        setSuggestions(data.suggestions ?? []);
        setActive(-1);
        setOpen((data.suggestions ?? []).length > 0);
      } catch {
        // Suggestions are a nice-to-have; typing + searching still works.
      }
    }, 250);
  }

  async function choose(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    onChange(s.secondary ? `${s.main}, ${s.secondary}` : s.main);
    setResolving(true);
    try {
      const params = new URLSearchParams({ id: s.id, session: session.current ?? "" });
      const res = await fetch(`/api/place-location?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSelect(data.location);
    } catch {
      onError("Couldn't look up that place. Try picking it again.");
    } finally {
      session.current = null; // the next search starts a new session
      setResolving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // choose the suggestion instead of submitting the form
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative flex-1">
      <input
        id="location"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={fieldClass}
        placeholder="Address, city, park, business…"
        value={value}
        aria-busy={resolving}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl bg-card py-1 shadow-xl ring-1 ring-black/10 dark:ring-white/15"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) so it fires before the input loses focus
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className="cursor-pointer px-3.5 py-2.5 aria-selected:bg-subtle"
            >
              <div className="truncate font-medium">{s.main}</div>
              {s.secondary && <div className="truncate text-xs text-muted">{s.secondary}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
