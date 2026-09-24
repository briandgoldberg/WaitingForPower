"use client";

import { useState, type ReactNode } from "react";
import { AdvocacyContactForm } from "./AdvocacyContactForm";

export type AdvocacyTab = "project" | "state" | "national" | "contact";

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
      {/* Underlined page tabs for the three content sections, deliberately
          not another pill/segmented control — the Projects tab has its own
          pill filter below, and stacking two pill controls read as one
          confusing double slider. "I Reached Out!" is a colored pill
          instead, on purpose: it's an action, not a content section, and
          should look different from the three it sits next to. */}
      <div className="flex items-center gap-4 sm:gap-6 border-b border-[var(--border)] flex-wrap" role="tablist">
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
        <button
          type="button"
          role="tab"
          aria-selected={tab === "contact"}
          onClick={() => setTab("contact")}
          className={`shrink-0 mb-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            tab === "contact"
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"
          }`}
        >
          I Reached Out!
        </button>
      </div>

      <div hidden={tab !== "national"}>{nationalAdvocacy}</div>
      <div hidden={tab !== "project"}>{projectAdvocacy}</div>
      <div hidden={tab !== "state"}>{stateAdvocacy}</div>
      <div hidden={tab !== "contact"}>
        <AdvocacyContactForm />
      </div>
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
