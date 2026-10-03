"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUtilitySearch } from "@/lib/useUtilitySearch";

// Home page's middle band — search ahead for a utility company to see the
// projects waiting in its service territory. Replaces the old
// CleanEnergyHeadline band. Reuses the full utility list already fetched
// for the Board's utility-tag picker (useUtilitySearch), filtered
// client-side as you type — same approach, same ~1,200-row dataset.
export function UtilitySearchSection() {
  const router = useRouter();
  const { utilities, loaded } = useUtilitySearch();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return utilities.filter((u) => u.utility.toLowerCase().includes(q)).slice(0, 8);
  }, [utilities, query]);

  function go(slug: string) {
    setQuery("");
    setOpen(false);
    router.push(`/utility/${slug}`);
  }

  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: "linear-gradient(120deg, #0c4a6e 0%, #0369a1 50%, #0891b2 100%)" }}
    >
      <div aria-hidden className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="relative mx-auto max-w-5xl w-full px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-4">
        <p className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight max-w-2xl">
          See the projects in permitting near you.
        </p>

        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={loaded ? "Search utility companies…" : "Loading utilities…"}
            aria-label="Search utility companies"
            disabled={!loaded}
            className="w-full min-h-[52px] rounded-full px-5 text-base text-[var(--foreground)] bg-white shadow-lg placeholder:text-[var(--muted)] disabled:opacity-70"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-10 mt-1.5 w-full max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] shadow-xl divide-y divide-[var(--border)]">
              {matches.map((u) => (
                <li key={u.slug}>
                  <button
                    type="button"
                    onClick={() => go(u.slug)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{u.utility}</span>
                    <span className="text-xs text-[var(--muted)] shrink-0">{u.count} projects</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && query.trim().length > 0 && matches.length === 0 && loaded && (
            <div className="absolute z-10 mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] shadow-xl px-4 py-2.5 text-sm text-[var(--muted)]">
              No utility matches &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
