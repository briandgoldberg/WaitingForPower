"use client";

import { useMemo, useState } from "react";
import { useUtilitySearch } from "@/lib/useUtilitySearch";

export interface UtilityTag {
  slug: string;
  utility: string;
}

// Type-ahead picker for tagging a Board topic to a utility company — reads
// the already-fetched full utility list (useUtilitySearch) and filters
// client-side (there's no per-keystroke search endpoint needed at ~1,200
// rows, unlike the project picker's much larger dataset).
export function UtilityTagPicker({ value, onChange }: { value: UtilityTag | null; onChange: (tag: UtilityTag | null) => void }) {
  const { utilities } = useUtilitySearch();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return utilities.filter((u) => u.utility.toLowerCase().includes(q)).slice(0, 8);
  }, [utilities, query]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--muted)]">Utility company</span>
      {value ? (
        <div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--accent)]/20"
          >
            {value.utility} <span aria-hidden>×</span>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search utility companies"
            aria-label="Search utility companies"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg divide-y divide-[var(--border)]">
              {matches.map((u) => (
                <li key={u.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ slug: u.slug, utility: u.utility });
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{u.utility}</span>
                    <span className="text-xs text-[var(--muted)] shrink-0">{u.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
