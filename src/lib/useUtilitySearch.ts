"use client";

import { useEffect, useState } from "react";

export interface UtilityOption {
  utility: string;
  slug: string;
  count: number;
}

// Fetches the full utility list once (GET /api/utilities, ~1,200 rows) for
// client-side substring filtering — shared by the homepage utility search
// and the Board's "tag a utility" picker rather than each doing its own
// fetch-and-filter.
export function useUtilitySearch() {
  const [utilities, setUtilities] = useState<UtilityOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/utilities")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: UtilityOption[]) => setUtilities(Array.isArray(data) ? data : []))
      .catch(() => setUtilities([]))
      .finally(() => setLoaded(true));
  }, []);

  return { utilities, loaded };
}
