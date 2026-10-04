"use client";

import { useState, type ReactNode } from "react";

export type AdvocacyTab = "national" | "hearings" | "comments";

export function AdvocacyTabs({
  defaultTab,
  nationalAdvocacy,
  publicHearings,
  publicComments,
}: {
  defaultTab: AdvocacyTab;
  nationalAdvocacy: ReactNode;
  publicHearings: ReactNode;
  publicComments: ReactNode;
}) {
  const [tab, setTab] = useState<AdvocacyTab>(defaultTab);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 sm:gap-6 border-b border-[var(--border)] flex-wrap" role="tablist">
        <TabButton active={tab === "national"} onClick={() => setTab("national")}>
          Email Congress
        </TabButton>
        <TabButton active={tab === "hearings"} onClick={() => setTab("hearings")}>
          Public Hearings
        </TabButton>
        <TabButton active={tab === "comments"} onClick={() => setTab("comments")}>
          Submit Public Comments
        </TabButton>
      </div>

      <div hidden={tab !== "national"}>{nationalAdvocacy}</div>
      <div hidden={tab !== "hearings"}>{publicHearings}</div>
      <div hidden={tab !== "comments"}>{publicComments}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`shrink-0 -mb-px px-0.5 pb-2.5 pt-1 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
        active
          ? "border-[var(--accent)]"
          : "border-transparent text-[var(--muted)] hover:text-[var(--text-secondary)]"
      }`}
      style={active ? { color: "var(--accent)" } : undefined}
    >
      {children}
    </button>
  );
}
