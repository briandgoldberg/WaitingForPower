"use client";

import { useState } from "react";
import Link from "next/link";
import { STATE_NAMES } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";

const STATES = Object.entries(STATE_NAMES)
  .filter(([code]) => STATE_REGULATORS[code])
  .sort((a, b) => a[1].localeCompare(b[1]));

export function StateAdvocacySection() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? STATES.filter(([code, name]) => name.toLowerCase().includes(q) || code.toLowerCase() === q) : STATES;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted)] max-w-2xl">
        Your state regulator decides most energy permits. Find yours, read what it is reviewing, and tell it what you think.
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find your state"
        aria-label="Find your state"
        className="w-full sm:w-72 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shown.map(([code, name]) => (
          <section key={code} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h3 className="text-base font-bold">{name}</h3>
              <Link href={`/state/${code}`} className="text-xs underline text-[var(--accent)] shrink-0">
                Projects
              </Link>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {STATE_REGULATORS[code].map((r) => (
                <li key={r.name}>
                  <span className="font-medium">{r.name}</span>
                  <div className="text-xs flex gap-3 mt-0.5">
                    <a href={r.website} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                      Website
                    </a>
                    {r.contactUrl && (
                      <a href={r.contactUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                        Contact
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {shown.length === 0 && <p className="text-sm text-[var(--muted)]">No state matches that.</p>}
      </div>
    </div>
  );
}
