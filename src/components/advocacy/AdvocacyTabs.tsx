"use client";

import { useState, type ReactNode } from "react";

type Tab = "national" | "hearings";

export function AdvocacyTabs({
  defaultTab,
  hearingCount,
  nationalAdvocacy,
  publicHearings,
}: {
  defaultTab: Tab;
  hearingCount: number;
  nationalAdvocacy: ReactNode;
  publicHearings: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1.5 rounded-full bg-black/5 dark:bg-white/10 p-1 w-fit max-w-full overflow-x-auto">
        <TabButton active={tab === "national"} onClick={() => setTab("national")}>
          National Advocacy
        </TabButton>
        <TabButton active={tab === "hearings"} onClick={() => setTab("hearings")}>
          Public Hearings{hearingCount > 0 && ` (${hearingCount})`}
        </TabButton>
      </div>

      <div hidden={tab !== "national"}>{nationalAdvocacy}</div>
      <div hidden={tab !== "hearings"}>{publicHearings}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? "bg-[var(--panel)] shadow-sm"
          : "text-[var(--muted)] hover:text-[var(--text-secondary)]"
      }`}
      style={active ? { color: "var(--accent)" } : undefined}
    >
      {children}
    </button>
  );
}
