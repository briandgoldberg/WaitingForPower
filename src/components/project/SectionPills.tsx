"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface PillSection {
  id: string;
  label: string;
  content: ReactNode;
}

// A row of pills under the headline numbers. Each one opens its section in a
// panel below (one at a time; tap again to close), so the page stays short
// but nothing is removed. Every panel is in the page HTML even while closed,
// so search engines and agents still read it, and a link like #take-action
// opens the right panel.
export function SectionPills({ sections }: { sections: PillSection[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const idKey = sections.map((s) => s.id).join(",");

  useEffect(() => {
    const ids = idKey.split(",");
    const openFromHash = () => {
      const id = window.location.hash.replace("#", "");
      if (ids.includes(id)) {
        setOpenId(id);
        setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      }
    };
    const t = setTimeout(openFromHash, 0);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, [idKey]);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Project sections">
        {sections.map((s) => {
          const open = openId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-expanded={open}
              aria-controls={s.id}
              onClick={() => setOpenId(open ? null : s.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                open
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-[var(--panel)] text-[var(--accent)] hover:border-[var(--accent)]"
              }`}
            >
              {s.label}
              <span aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>
                ›
              </span>
            </button>
          );
        })}
      </div>

      {sections.map((s) => (
        <div
          key={s.id}
          id={s.id}
          hidden={openId !== s.id}
          className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5 scroll-mt-4"
        >
          {s.content}
        </div>
      ))}
    </div>
  );
}
