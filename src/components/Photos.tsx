"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Photo } from "@/lib/db";

const MAX_PHOTOS_AT_ONCE = 8;

// Choose photos to upload, with previews. Nothing is uploaded until the form saves.
export function PhotoPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {previews.map((url, i) => (
          <div key={url} className="relative h-20 w-20">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a chosen file */}
            <img src={url} alt={`Selected photo ${i + 1}`} className="h-full w-full rounded-lg object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-sm text-background shadow"
            >
              ×
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS_AT_ONCE && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted hover:border-accent hover:text-accent"
          >
            <CameraIcon />
            Add photos
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const chosen = Array.from(e.target.files ?? []);
          onChange([...files, ...chosen].slice(0, MAX_PHOTOS_AT_ONCE));
          e.target.value = ""; // allow choosing the same file again after removing it
        }}
      />
    </div>
  );
}

// Thumbnails for a visit; tap one to view it full-screen.
export function PhotoGallery({ photos, onDelete }: { photos: Photo[]; onDelete?: (p: Photo) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const current = open !== null ? photos[open] : null;

  return (
    <>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-subtle"
            aria-label={`View photo ${i + 1} of ${photos.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL from Supabase */}
            <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={() => setOpen(null)}
        >
          <div className="flex items-center justify-between p-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <span>
              {open! + 1} / {photos.length}
            </span>
            <div className="flex gap-4">
              {onDelete && (
                <button
                  type="button"
                  className="text-white/80 hover:text-white"
                  onClick={() => {
                    if (!confirm("Delete this photo?")) return;
                    onDelete(current);
                    setOpen(null);
                  }}
                >
                  Delete
                </button>
              )}
              <button type="button" className="font-medium" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL from Supabase */}
            <img
              src={current.url}
              alt={`Photo ${open! + 1}`}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen((open! - 1 + photos.length) % photos.length);
                  }}
                  className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen((open! + 1) % photos.length);
                  }}
                  className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
