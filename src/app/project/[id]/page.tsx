import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";
import type { ProjectDTO } from "@/lib/types";
import { FUEL_TYPE_BY_VALUE, formatCapacity, PRIME_MOVER_LABELS, PROJECT_STAGE_BY_VALUE, RESOLVED_STAGES, VERIFICATION_STATUS_BY_VALUE } from "@/lib/data/taxonomies";
import { formatUsd } from "@/lib/calc/investmentWaiting";
import { ShareButtons } from "@/components/ShareButtons";
import { STATE_NAMES, splitStateCodes, stateName } from "@/lib/data/usStates";
import { buildHearingEventsJsonLd } from "@/lib/seo/hearingEvents";
import { buildBreadcrumbJsonLd } from "@/lib/seo/breadcrumbs";
import { isPredictionEligibleState } from "@/lib/data/predictionEligibleStates";
import { TakeActionSection } from "@/components/project/TakeActionSection";
import { ProjectDiscussion } from "@/components/ProjectDiscussion";

export const dynamic = "force-dynamic";

// Deduped per-request via React's cache() so generateMetadata and the page
// component (both invoked separately by Next.js for the same request)
// don't double the DB round trip.
const getProject = cache(async (slug: string) => {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { causes: true, sources: true, milestones: true, hearings: true },
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
    alternates: { canonical: `/project/${p.slug}` },
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

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProject(id);

  if (!p) notFound();

  const fuel = FUEL_TYPE_BY_VALUE[p.fuelType];
  const stateCodes = splitStateCodes(p.state);
  const singleStateCode = stateCodes.length === 1 && stateCodes[0] in STATE_NAMES ? stateCodes[0] : null;
  const hearingEventsJsonLd = buildHearingEventsJsonLd({
    projectName: p.name,
    projectUrl: `https://waitingforpower.com/project/${p.slug}`,
    hearingDetailsLink: p.hearingDetailsLink,
    hearings: p.hearings,
    stateCode: singleStateCode,
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: "https://waitingforpower.com" },
    { name: "Projects", url: "https://waitingforpower.com/projects" },
    ...(singleStateCode
      ? [{ name: stateName(singleStateCode), url: `https://waitingforpower.com/state/${singleStateCode}` }]
      : []),
    { name: p.name },
  ]);

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-4 flex flex-col gap-4">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {hearingEventsJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(hearingEventsJsonLd) }}
        />
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
              <p className="text-sm text-[var(--muted)] mt-0.5">
                Developer: {p.applicant}
                {p.ownerSector && ` (${p.ownerSector})`}
              </p>
            )}
          </div>
          <ShareButtons url={`https://waitingforpower.com/project/${p.slug}`} text={shareText(p)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <PrimaryStat label="Capacity" value={formatCapacity(p.capacityValue, p.capacityUnit)} />
        <PrimaryStat label="Waiting" value={p.yearsWaiting != null ? `${p.yearsWaiting.toFixed(1)} yrs` : "—"} />
        <PrimaryStat
          label="Est. investment waiting"
          value={p.investmentWaiting.applicable ? formatUsd(p.investmentWaiting.estimatedUsd!) : "—"}
          href="/methodology"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat
          label="Stage"
          value={PROJECT_STAGE_BY_VALUE[p.currentStage] ?? p.currentStage.replace(/_/g, " ")}
          sub={[p.interconnectionQueueStage && `Queue: ${p.interconnectionQueueStage}`, p.queueCluster && `Cluster: ${p.queueCluster}`].filter(
            (x): x is string => Boolean(x),
          )}
        />
        {(p.balancingAuthority || p.pointOfInterconnection) && (
          <Stat
            label={p.balancingAuthority ? "Grid region" : "Point of interconnection"}
            value={(p.balancingAuthority ?? p.pointOfInterconnection)!}
            sub={p.balancingAuthority && p.pointOfInterconnection ? [`Point of interconnection: ${p.pointOfInterconnection}`] : undefined}
          />
        )}
        {p.primeMoverCode && <Stat label="Equipment" value={PRIME_MOVER_LABELS[p.primeMoverCode] ?? p.primeMoverCode} />}
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

      <TakeActionSection
        project={p}
        nowMs={new Date().getTime()}
        canPredict={!p.isAggregateExample && !RESOLVED_STAGES.includes(p.currentStage) && isPredictionEligibleState(p.state)}
      />

      {p.networkUpgradeCostUsd != null && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="text-base font-semibold text-[var(--accent)] mb-2">Estimated interconnection cost</h2>
          <div className="text-3xl font-bold tabular-nums">
            {formatUsd((p.poiCostUsd ?? 0) + p.networkUpgradeCostUsd)}
          </div>
          {p.poiCostUsd != null && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {formatUsd(p.poiCostUsd)} point-of-interconnection + {formatUsd(p.networkUpgradeCostUsd)} network upgrade
            </p>
          )}
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            The cost of grid upgrades needed to connect this project, from LBNL&rsquo;s
            interconnection cost-analysis research. LBNL&rsquo;s own docs call these estimates
            preliminary — see the data quality note below.
          </p>
        </section>
      )}

      {p.milestones.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="text-base font-semibold text-[var(--accent)] mb-3">Timeline</h2>
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

      <section id="comments" className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 scroll-mt-4">
        <ProjectDiscussion projectId={p.id} />
      </section>

      <section aria-label="Sources" className="px-1 text-[11px] leading-snug text-[var(--muted)]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold uppercase tracking-wide text-[10px]">Sources</span>
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] ${
              p.verificationStatus === "user_submitted_pending"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            {p.verificationStatus === "user_submitted_pending" ? "⏳" : "✓"}{" "}
            {VERIFICATION_STATUS_BY_VALUE[p.verificationStatus] ?? p.verificationStatus.replace(/_/g, " ")}
          </span>
          {p.sources.map((src) => (
            <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className="underline">
              {src.label}
            </a>
          ))}
        </div>
        {p.dataQualityNote && (
          <p className="mt-1">
            <strong>Data quality note:</strong> {p.dataQualityNote}
          </p>
        )}
      </section>
    </div>
  );
}

// The three headline numbers: filled and larger than the secondary Stat
// cards so they read first.
function PrimaryStat({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-xl bg-[var(--accent)] text-white p-3 sm:p-4 flex flex-col justify-between min-w-0">
      <div className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-white/75">
        {href ? (
          <Link href={href} className="hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </div>
      <div className="text-xl sm:text-3xl font-bold tabular-nums mt-1 break-words">{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  accentColor,
  sub,
  href,
}: {
  label: string;
  value: string;
  accentColor?: string;
  sub?: string[];
  href?: string;
}) {
  return (
    <div
      className="flex-1 min-w-[130px] rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 border-l-[3px]"
      style={{ borderLeftColor: accentColor ?? "var(--accent)" }}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {href ? (
          <Link href={href} className="hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </div>
      <div className="text-base font-bold mt-0.5">{value}</div>
      {sub?.map((line) => (
        <div key={line} className="text-xs text-[var(--muted)] mt-0.5">
          {line}
        </div>
      ))}
    </div>
  );
}
