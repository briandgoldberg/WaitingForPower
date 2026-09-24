"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

// Remembers which ad (utm_* link) brought a visitor in; see src/lib/attribution.ts.
export function AttributionTracker() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
