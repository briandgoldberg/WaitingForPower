"use client";

import { useEffect, useState } from "react";

export interface ProjectTag {
  slug: string;
  name: string;
  state: string | null;
}

interface ProjectMatch {
  id: string;
  slug: string;
  name: string;
  state: string | null;
}

// Type-ahead picker for tagging a Board topic to a specific project —
// debounced server search (GET /api/projects/search) rather than fetching
// the ~2,500-row full dataset client-side, unlike the much smaller utility
// list UtilityTagPicker filters in the browser.
export function ProjectTagPicker({ value, onChange }: { value: ProjectTag | null; onChange: (tag: ProjectTag | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/projects/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: ProjectMatch[] }) => setResults(d.results))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--muted)]">Project</span>
      {value ? (
        <div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--accent)]/20"
          >
            {value.name} <span aria-hidden>×</span>
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
            placeholder="Search projects by name"
            aria-label="Search projects by name"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          {searching && <p className="text-xs text-[var(--muted)] mt-1">Searching…</p>}
          {open && results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg divide-y divide-[var(--border)]">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ slug: p.slug, name: p.name, state: p.state });
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {p.name}
                    {p.state && <span className="text-[var(--muted)]"> · {p.state}</span>}
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
