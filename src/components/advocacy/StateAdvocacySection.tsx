"use client";

import { useState } from "react";
import Link from "next/link";
import { STATE_NAMES } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { STATE_COMMENT_RULES, type RecordRule } from "@/lib/data/stateCommentRules";

const RULE_LABEL: Record<RecordRule, string> = {
  closes_at_hearing: "Comments close at the hearing",
  open_until_decision: "Comments open until the decision",
  varies: "Rules vary by case",
  unknown: "Comment rules not confirmed",
};

const STATES = Object.entries(STATE_NAMES)
  .filter(([code]) => STATE_REGULATORS[code])
  .sort((a, b) => a[1].localeCompare(b[1]));

export function StateAdvocacySection() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? STATES.filter(([code, name]) => name.toLowerCase().includes(q) || code.toLowerCase() === q) : STATES;

  return (
    <div className="flex flex-col gap-4">
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
            {STATE_COMMENT_RULES[code] && (
              <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs flex flex-col gap-1">
                <span className="font-semibold">{RULE_LABEL[STATE_COMMENT_RULES[code].recordRule]}</span>
                {STATE_COMMENT_RULES[code].howToComment && <span className="text-[var(--text-secondary)]">{STATE_COMMENT_RULES[code].howToComment}</span>}
                {STATE_COMMENT_RULES[code].ruleNote && <span className="text-[var(--muted)]">{STATE_COMMENT_RULES[code].ruleNote}</span>}
                {STATE_COMMENT_RULES[code].commentUrl && (
                  <a href={STATE_COMMENT_RULES[code].commentUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline w-fit">
                    How to comment
                  </a>
                )}
              </div>
            )}
          </section>
        ))}
        {shown.length === 0 && <p className="text-sm text-[var(--muted)]">No state matches that.</p>}
      </div>
    </div>
  );
}
