"use client";

import { useState, type ReactNode } from "react";

export type AdvocacyTab = "project" | "state" | "national";

export function AdvocacyTabs({
  defaultTab,
  nationalAdvocacy,
  stateAdvocacy,
  projectAdvocacy,
}: {
  defaultTab: AdvocacyTab;
  nationalAdvocacy: ReactNode;
  stateAdvocacy: ReactNode;
  projectAdvocacy: ReactNode;
}) {
  const [tab, setTab] = useState<AdvocacyTab>(defaultTab);

  return (
    <div className="flex flex-col gap-5">
      {/* Underlined page tabs, deliberately not another pill/segmented control —
          the Projects tab has its own pill filter below, and stacking two
          pill controls read as one confusing double slider. */}
      <div className="flex gap-4 sm:gap-6 border-b border-[var(--border)]" role="tablist">
        <TabButton active={tab === "national"} onClick={() => setTab("national")}>
          <span className="sm:hidden">National</span>
          <span className="hidden sm:inline">National Advocacy</span>
        </TabButton>
        <TabButton active={tab === "project"} onClick={() => setTab("project")}>
          <span className="sm:hidden">Projects</span>
          <span className="hidden sm:inline">Project Advocacy</span>
        </TabButton>
        <TabButton active={tab === "state"} onClick={() => setTab("state")}>
          <span className="sm:hidden">States</span>
          <span className="hidden sm:inline">State Advocacy</span>
        </TabButton>
      </div>

      <div hidden={tab !== "national"}>{nationalAdvocacy}</div>
      <div hidden={tab !== "project"}>{projectAdvocacy}</div>
      <div hidden={tab !== "state"}>{stateAdvocacy}</div>
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
