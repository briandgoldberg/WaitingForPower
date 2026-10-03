import Link from "next/link";
import { getCleanEnergyWaiting, getStorageHearings, type SpeakUpHearing } from "@/lib/homeHighlights";
import { SpeakUpHearings } from "@/components/home/SpeakUpHearings";
import { CleanEnergyHeadline } from "@/components/home/CleanEnergyHeadline";

export const dynamic = "force-dynamic";

// schema.org Dataset markup — lets search engines and AI agents identify
// this as a queryable dataset (with a machine-readable distribution) rather
// than just a webpage. See also /llms.txt and /api/projects.
const DATASET_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "WaitingForPower: U.S. Energy Project Permitting Tracker",
  description:
    "Live, sourced dataset of U.S. energy projects — generation, transmission, storage, LNG, and pipelines, every fuel type — currently stuck waiting on permitting approval, merged from public federal/state sources and refreshed automatically.",
  url: "https://waitingforpower.com",
  license: "https://github.com/briandgoldberg/WaitingForPower/blob/main/LICENSE",
  creator: { "@type": "Person", name: "Brian Goldberg" },
  spatialCoverage: { "@type": "Place", name: "United States" },
  keywords: [
    "energy",
    "permitting reform",
    "renewable energy",
    "transmission",
    "solar",
    "wind",
    "pipelines",
    "clean energy",
    "infrastructure",
  ],
  distribution: {
    "@type": "DataDownload",
    encodingFormat: "application/json",
    contentUrl: "https://waitingforpower.com/api/projects",
  },
};

const ALERT_MESSAGES: Record<string, string> = {
  confirmed: "You're subscribed — we'll email you weekly with updates.",
  unsubscribed: "You've been unsubscribed from weekly feed updates.",
  invalid: "That link has expired or was already used.",
  "profile-saved": "Email confirmed. Your name and history are saved.",
  "email-taken": "That email already has a saved profile. Sign in with it instead.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ alert?: string }>;
}) {
  const { alert } = await searchParams;
  const alertMessage = alert ? ALERT_MESSAGES[alert] : undefined;

  // Live figures; the page still renders (without these sections) if the
  // database is unreachable.
  let clean: { homes: number; mw: number } | null = null;
  let speakUp: SpeakUpHearing[] = [];
  try {
    [clean, speakUp] = await Promise.all([getCleanEnergyWaiting(), getStorageHearings(2)]);
  } catch (err) {
    console.error("Home highlights failed:", err);
  }

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATASET_JSON_LD) }}
      />
      {alertMessage && (
        <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
            {alertMessage}
          </div>
        </div>
      )}

      {/* Full-bleed hero band — deliberately always dark regardless of site
          theme, like a print ad, rather than tracking --background/--panel. */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: "linear-gradient(135deg, #0b1b2e 0%, #16324f 55%, #1e3a5f 100%)" }}
      >
        {/* Faint diagonal grid — a hint of blueprint/schematic texture behind the copy, not a distraction. */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div className="relative mx-auto max-w-5xl w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-4">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#f2b866]">
            Energy Permitting Reform
          </span>
          <p className="text-xl sm:text-3xl font-bold tracking-tight leading-tight max-w-3xl">
            While America&rsquo;s demand for power rapidly rises, critical energy projects spend years stuck in
            convoluted permitting processes and legal challenges. America needs bipartisan energy permitting reform
            to build affordable, reliable, and clean power our citizens demand.
          </p>
          <Link
            href="/policies"
            className="inline-flex items-center justify-center gap-1.5 self-stretch sm:self-start min-h-[52px] rounded-full px-8 text-base font-bold shadow-lg transition-transform hover:scale-[1.03]"
            style={{ background: "#f2b866", color: "#0b1b2e" }}
          >
            Advocate for Permit Reform Now →
          </Link>
        </div>
      </section>

      {clean && <CleanEnergyHeadline homes={clean.homes} />}

      <SpeakUpHearings groups={speakUp} />
    </>
  );
}
