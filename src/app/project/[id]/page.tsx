import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";
import type { ProjectDTO } from "@/lib/types";
import { FUEL_TYPE_BY_VALUE, formatCapacity, PROJECT_STAGE_BY_VALUE } from "@/lib/data/taxonomies";
import { formatUsd } from "@/lib/calc/investmentWaiting";
import { ShareButtons } from "@/components/ShareButtons";
import { SubscribeBox } from "@/components/SubscribeBox";
import { STATE_NAMES, splitStateCodes } from "@/lib/data/usStates";

export const dynamic = "force-dynamic";

// Deduped per-request via React's cache() so generateMetadata and the page
// component (both invoked separately by Next.js for the same request)
// don't double the DB round trip.
const getProject = cache(async (slug: string) => {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { causes: true, sources: true, milestones: true },
  });
  return project ? serializeProject(project) : null;
});

// Facebook's share dialog scrapes these Open Graph tags for its post text
// rather than taking a URL param — see src/components/ShareButtons.tsx.
// Kept as one function so the share-button text and the OG text can't
// drift apart.
function shareText(p: ProjectDTO): string {
  return `${p.name} has been waiting${p.yearsWaiting != null ? ` ${p.yearsWaiting.toFixed(1)} years` : ""} for approval. Tracked on WaitingForPower.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await getProject(id);
  if (!p) return {};

  const description = shareText(p);
  return {
    title: `${p.name} | WaitingForPower`,
    description,
    openGraph: {
      title: p.name,
      description,
      url: `https://waitingforpower.com/project/${p.slug}`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: p.name,
      description,
    },
  };
}

const ALERT_MESSAGES: Record<string, string> = {
  confirmed: "You're subscribed — we'll email you when this project updates.",
  unsubscribed: "You've been unsubscribed from updates for this project.",
  invalid: "That link has expired or was already used.",
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ alert?: string }>;
}) {
  const { id } = await params;
  const { alert } = await searchParams;
  const p = await getProject(id);

  if (!p) notFound();

  const alertMessage = alert ? ALERT_MESSAGES[alert] : undefined;

  const fuel = FUEL_TYPE_BY_VALUE[p.fuelType];
  const stateCodes = splitStateCodes(p.state);
  const singleStateCode = stateCodes.length === 1 && stateCodes[0] in STATE_NAMES ? stateCodes[0] : null;

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      {alertMessage && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
          {alertMessage}
        </div>
      )}
      {p.isAggregateExample && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
          <strong>This is a regional aggregate, not a single physical project.</strong> It&rsquo;s
          included to illustrate the interconnection-queue-backlog category with real, cited
          numbers and is excluded from this site&rsquo;s aggregate headline stats. See
          &ldquo;Data quality notes&rdquo; below.
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: fuel?.color ?? "#6b7280" }}
          />
          <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
            {p.projectType} · {fuel?.label ?? p.fuelType}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{p.name}</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {p.county && `${p.county}, `}
              {singleStateCode ? (
                <Link href={`/state/${singleStateCode}`} className="underline">
                  {p.state}
                </Link>
              ) : (
                p.state
              )}
              {!p.county && !p.state && "Location not specified"}
            </p>
            {p.applicant && (
              <p className="text-sm text-[var(--muted)] mt-0.5">Developer: {p.applicant}</p>
            )}
          </div>
          <ShareButtons url={`https://waitingforpower.com/project/${p.slug}`} text={shareText(p)} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Capacity" value={formatCapacity(p.capacityValue, p.capacityUnit)} />
        <Stat label="Waiting" value={p.yearsWaiting != null ? `${p.yearsWaiting.toFixed(1)} yrs` : "—"} />
        <Stat label="Stage" value={PROJECT_STAGE_BY_VALUE[p.currentStage] ?? p.currentStage.replace(/_/g, " ")} />
        <Stat label="Verification" value={p.verificationStatus.replace(/_/g, " ")} />
        {p.interconnectionQueueStage && <Stat label="Queue stage" value={p.interconnectionQueueStage} />}
        {p.expectedOnlineDate && (
          <Stat
            label="Expected online"
            value={`${new Date(p.expectedOnlineDate).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" })}${p.expectedOnlineDateConfidence === "approximate" ? "*" : ""}`}
          />
        )}
      </div>
      {p.expectedOnlineDateConfidence === "approximate" && p.expectedOnlineDate && (
        <p className="text-xs text-[var(--muted)] -mt-2">* Approximate / developer-estimated date, not a firm commitment.</p>
      )}

      <div className={`grid grid-cols-1 gap-4 ${p.networkUpgradeCostUsd != null ? "md:grid-cols-2" : ""}`}>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="text-lg font-semibold mb-2">Estimated investment waiting</h2>
          {p.investmentWaiting.applicable ? (
            <>
              <div className="text-3xl font-bold tabular-nums">{formatUsd(p.investmentWaiting.estimatedUsd!)}</div>
              <p className="text-xs text-[var(--muted)] mt-2">
                ≈ {Math.round((p.capacityValue ?? 0) * 1000).toLocaleString("en-US")} kW × $
                {p.investmentWaiting.costPerKw?.toLocaleString("en-US")}/kW typical overnight
                construction cost (EIA) — the dollar value of the power plant itself sitting in
                permitting limbo, not a bill estimate.{" "}
                <Link href="/methodology" className="underline">
                  Full methodology
                </Link>
                .
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Not estimated: {p.investmentWaiting.reason}</p>
          )}
        </section>

        {p.networkUpgradeCostUsd != null && (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
            <h2 className="text-lg font-semibold mb-2">Estimated network upgrade cost</h2>
            <div className="text-3xl font-bold tabular-nums">{formatUsd(p.networkUpgradeCostUsd)}</div>
            <p className="text-xs text-[var(--muted)] mt-2">
              The cost of grid upgrades needed to connect this project, from LBNL&rsquo;s
              interconnection cost-analysis research. LBNL&rsquo;s own docs call these estimates
              preliminary — see the data quality note below.
            </p>
          </section>
        )}
      </div>

      <SubscribeBox projectId={p.id} projectName={p.name} />

      {(p.lat != null && p.lon != null) && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="text-lg font-semibold mb-2">Location</h2>
          <p className="text-sm text-[var(--muted)]">
            {p.lat.toFixed(4)}, {p.lon.toFixed(4)} — see the{" "}
            <Link href="/" className="underline">
              map
            </Link>{" "}
            for this project in context with others.
          </p>
        </section>
      )}

      {p.milestones.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="text-lg font-semibold mb-3">Timeline</h2>
          <ul className="flex flex-col gap-3">
            {p.milestones.map((m, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <div className="w-24 shrink-0 tabular-nums text-[var(--muted)]">
                  {new Date(m.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  {m.dateConfidence === "approximate" && <span className="text-xs">*</span>}
                </div>
                <div>
                  <span className="font-medium">{m.description}</span>
                  <span className="text-[var(--muted)]"> — {m.stage}</span>
                </div>
              </li>
            ))}
          </ul>
          {p.milestones.some((m) => m.dateConfidence === "approximate") && (
            <p className="text-xs text-[var(--muted)] mt-3">* Approximate date.</p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold mb-2">Sources</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {p.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        {p.dataQualityNote && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] text-xs text-[var(--muted)]">
            <strong>Data quality note:</strong> {p.dataQualityNote}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="text-base font-semibold capitalize">{value}</div>
      <div className="text-xs text-[var(--muted)] mt-0.5">{label}</div>
    </div>
  );
}
