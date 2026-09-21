"use client";

import { useState, type ReactNode } from "react";

export type AdvocacyTab = "national" | "state" | "project";

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
      <div className="grid grid-cols-3 gap-1 rounded-2xl sm:flex sm:gap-1.5 sm:rounded-full bg-black/5 dark:bg-white/10 p-1 w-full sm:w-fit sm:max-w-full sm:overflow-x-auto">
        <TabButton active={tab === "national"} onClick={() => setTab("national")}>
          National Advocacy
        </TabButton>
        <TabButton active={tab === "state"} onClick={() => setTab("state")}>
          State Advocacy
        </TabButton>
        <TabButton active={tab === "project"} onClick={() => setTab("project")}>
          Projects
        </TabButton>
      </div>

      <div hidden={tab !== "national"}>{nationalAdvocacy}</div>
      <div hidden={tab !== "state"}>{stateAdvocacy}</div>
      <div hidden={tab !== "project"}>{projectAdvocacy}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sm:shrink-0 px-2.5 sm:px-3.5 py-1.5 rounded-full text-sm font-medium text-center sm:whitespace-nowrap transition-colors ${
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
