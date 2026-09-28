import Link from "next/link";

// "100 million+": rounded down to a round number so the claim is always an
// understatement (109 million -> "100 million+", 8.4 million -> "8 million+").
function roundedDown(homes: number): string {
  const m = homes / 1_000_000;
  const step = m >= 10 ? 10 : 1;
  return `${Math.floor(m / step) * step} million+`;
}

// Home page headline, full width: homes the clean generation waiting on a
// decision could power (see lib/homeHighlights.ts). Hidden under a million.
export function CleanEnergyHeadline({ homes }: { homes: number }) {
  if (homes < 1_000_000) return null;
  return (
    <section className="relative overflow-hidden text-white" style={{ background: "linear-gradient(120deg, #065f46 0%, #047857 45%, #0f766e 100%)" }}>
      <div aria-hidden className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="relative mx-auto max-w-5xl w-full px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7">
        <svg viewBox="0 0 24 24" aria-hidden className="h-14 w-14 sm:h-20 sm:w-20 shrink-0 text-white">
          <path d="M12 3 2.5 11h2.5v9h5.5v-5.5h3V20H19v-9h2.5z" fill="currentColor" />
          <path d="M13.2 5.2 10 10.6h2.2l-1.4 4.2 3.6-5.6h-2.3z" fill="#fcd34d" />
        </svg>
        <div className="min-w-0 flex flex-col gap-4 items-start">
          <p className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
            Enough clean energy to power <span className="text-amber-300">{roundedDown(homes)} homes</span> is stuck waiting for approval.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm sm:text-base font-bold shadow hover:bg-amber-100 transition-colors"
            style={{ color: "#064e3b" }}
          >
            See the projects →
          </Link>
        </div>
      </div>
    </section>
  );
}
