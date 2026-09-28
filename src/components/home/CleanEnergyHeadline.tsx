import Link from "next/link";

// Home page headline: homes the clean generation waiting on a decision could
// power (see lib/homeHighlights.ts). Hidden under a million, where "N million
// homes" would round to nothing.
export function CleanEnergyHeadline({ homes, mw }: { homes: number; mw: number }) {
  if (homes < 1_000_000) return null;
  const cleanHomesMillions = Math.round(homes / 1_000_000);
  return (
    <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-8">
      <Link
        href="/projects"
        className="group rounded-2xl border border-emerald-300/70 dark:border-emerald-700/60 bg-gradient-to-br from-emerald-50 via-[var(--panel)] to-amber-50/60 dark:from-emerald-950/50 dark:via-[var(--panel)] dark:to-amber-950/20 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-14 w-14 sm:h-20 sm:w-20 shrink-0 text-emerald-500 dark:text-emerald-400">
          <path d="M12 3 2.5 11h2.5v9h5.5v-5.5h3V20H19v-9h2.5z" fill="currentColor" />
          <path d="M13.2 5.2 10 10.6h2.2l-1.4 4.2 3.6-5.6h-2.3z" className="fill-amber-300" />
        </svg>
        <div className="min-w-0">
          <p className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
            Enough clean energy to power {cleanHomesMillions} million homes is stuck waiting for approval.
          </p>
          <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)]">
            {Math.round(mw).toLocaleString("en-US")} MW of solar, wind, nuclear, hydro and geothermal projects are
            waiting on a decision.{" "}
            <span className="font-semibold text-[var(--accent)] group-hover:underline">See the projects →</span>
          </p>
        </div>
      </Link>
    </section>
  );
}
