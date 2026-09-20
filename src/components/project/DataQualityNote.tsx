"use client";

import { useState } from "react";

const PREVIEW_CHARS = 90;

// Source notes use long dashes as asides; show them as plain commas.
function withoutDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ");
}

// Data quality notes can run long. Show a short preview and let the reader
// expand it, so the bottom of the page stays quiet.
export function DataQualityNote({ note: rawNote }: { note: string }) {
  const note = withoutDashes(rawNote);
  const [open, setOpen] = useState(false);
  const isLong = note.length > PREVIEW_CHARS;
  const preview = isLong ? `${note.slice(0, PREVIEW_CHARS).replace(/\s+\S*$/, "")}…` : note;

  return (
    <p className="mt-1">
      <strong>Data quality note:</strong> {open || !isLong ? note : preview}
      {isLong && (
        <>
          {" "}
          <button type="button" onClick={() => setOpen((o) => !o)} className="underline">
            {open ? "less" : "more"}
          </button>
        </>
      )}
    </p>
  );
}
