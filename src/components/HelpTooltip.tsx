"use client";

import { useEffect, useRef, useState } from "react";

export function HelpTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={`How is "${label}" calculated?`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--muted)] text-[9px] leading-none text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] align-middle"
      >
        ?
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute z-30 top-full mt-2 left-0 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg p-3 text-xs leading-relaxed text-left font-normal normal-case"
        >
          {children}
        </div>
      )}
    </span>
  );
}
