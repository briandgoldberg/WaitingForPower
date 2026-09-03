"use client";

import { useRouter } from "next/navigation";
import { STATE_NAMES } from "@/lib/data/usStates";

const STATE_OPTIONS = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]));

export function StateFeedFilter({ state }: { state: string | null }) {
  const router = useRouter();

  return (
    <select
      value={state ?? ""}
      onChange={(e) => router.push(e.target.value ? `/?state=${e.target.value}` : "/")}
      aria-label="Filter feed by state"
      className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-sm"
    >
      <option value="">All states</option>
      {STATE_OPTIONS.map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  );
}
