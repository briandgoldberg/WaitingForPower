import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { mergedChildren, overlayMerged } from "@/lib/dedupe";
import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";
import type { ProjectDTO } from "@/lib/types";
import { FUEL_TYPE_BY_VALUE, formatCapacity, PRIME_MOVER_LABELS, PROJECT_STAGE_BY_VALUE, RESOLVED_STAGES, type ProjectStage } from "@/lib/data/taxonomies";
import { formatUsd } from "@/lib/calc/investmentWaiting";
import { ShareButtons } from "@/components/ShareButtons";
import { STATE_NAMES, splitStateCodes, stateName } from "@/lib/data/usStates";
import { buildHearingEventsJsonLd } from "@/lib/seo/hearingEvents";
import { buildBreadcrumbJsonLd } from "@/lib/seo/breadcrumbs";
import { TakeActionSection } from "@/components/project/TakeActionSection";
import { SectionPills, type PillSection } from "@/components/project/SectionPills";
import { ProjectDiscussion } from "@/components/ProjectDiscussion";
import { OutcomeBanner } from "@/components/project/OutcomeBanner";
import { outcomeOf, isResolved, yearsBetween } from "@/lib/projectOutcome";
import { withoutDashes } from "@/lib/text";
import { CAUSE_CATEGORY_BY_SLUG } from "@/lib/data/causeCategories";

export const dynamic = "force-dynamic";

// Deduped per-request via React's cache() so generateMetadata and the page
// component (both invoked separately by Next.js for the same request)
// don't double the DB round trip.
const getProject = cache(async (slug: string) => {
  const include = { causes: true, sources: true, milestones: true, hearings: true } as const;
  let project = await prisma.project.findUnique({ where: { slug }, include });
  // A duplicate merged into another project (see src/lib/dedupe.ts) shows that
  // project instead; the page redirects to its slug.
  if (project?.mergedIntoId) project = await prisma.project.findUnique({ where: { id: project.mergedIntoId }, include });
  if (!project) return null;
  return serializeProject(overlayMerged(project, await mergedChildren([project.id])));
});

// Facebook's share dialog scrapes these Open Graph tags for its post text
// rather than taking a URL param — see src/components/ShareButtons.tsx.
// Kept as one function so the share-button text and the OG text can't
// drift apart.
function shareText(p: ProjectDTO): string {
  const outcome = outcomeOf(p);
  if (outcome === "approved") return `${p.name} has been approved. Tracked on WaitingForPower.`;
  if (outcome === "cancelled") return `${p.name} was cancelled. Tracked on WaitingForPower.`;
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
  if (p.slug !== id) permanentRedirect(`/project/${p.slug}`);

  const fuel = FUEL_TYPE_BY_VALUE[p.fuelType];
  const outcome = outcomeOf(p);
  const resolved = isResolved(outcome);
  // When we first saw the project resolved, and the stage it was in before.
  // Used as an estimated date when the source didn't publish a real one, and
  // to show a cancelled project's last stage.
  const observed = resolved
    ? await prisma.projectChange.findFirst({
        where: { projectId: p.id, changeTypes: { has: "resolved" } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, previousStage: true },
      })
    : null;
  const waitedYears = resolved ? yearsBetween(p.applicationFiledDate, p.resolutionDate) : p.yearsWaiting;
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

  // The three headline numbers. "Waiting" and "investment waiting" only make
  // sense for a project still in permitting, so a resolved project shows what
  // it waited instead.
  const primaryCards: { label: string; value: string; href?: string; note?: string; help?: string }[] = [
    { label: "Project Capacity", help: "Size of the proposed project.", value: formatCapacity(p.capacityValue, p.capacityUnit) },
  ];
  if (resolved) {
    // Approved and cancelled share one skeleton: capacity, how long it took,
    // then, for cancelled, the last stage reached. Each slot is dropped when
    // unknown. No investment figure once a project is resolved.
    if (waitedYears != null) {
      primaryCards.push({ label: "Time Pending", help: "Years from filing to the decision.", value: `${waitedYears.toFixed(1)} yrs` });
    } else if (p.applicationFiledDate) {
      primaryCards.push({
        label: "Filed",
        value: new Date(p.applicationFiledDate).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      });
    }
    const lastStage = observed?.previousStage ? PROJECT_STAGE_BY_VALUE[observed.previousStage as ProjectStage] : undefined;
    if (outcome === "cancelled" && lastStage) primaryCards.push({ label: "Last stage", help: "The stage it reached before it was cancelled.", value: lastStage });
  } else {
    primaryCards.push({ label: "Time\nPending", help: "Years since the application was filed with no final decision.", value: waitedYears != null ? `${waitedYears.toFixed(1)} yrs` : "—" });
    primaryCards.push(
      p.investmentWaiting.applicable
        ? { label: "Deferred Investment", help: "Estimated construction cost: capacity times typical cost per kW. Not spent yet, because it is waiting on approval.", value: formatUsd(p.investmentWaiting.estimatedUsd!), href: "/methodology" }
        : { label: "Deferred Investment", help: "Estimated construction cost, available only for MW capacity.", value: "—", note: "Estimated only for MW capacity" },
    );
  }
  const causeLabels = p.causeSlugs.map((slug) => CAUSE_CATEGORY_BY_SLUG[slug]?.label).filter((l): l is string => Boolean(l));

  const nowMs = new Date().getTime();
  const detailsContent = (
    <>
        <div
          className="grid gap-x-5 gap-y-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}
        >
          {!resolved && (
            <Detail
              label="Stage"
              value={PROJECT_STAGE_BY_VALUE[p.currentStage] ?? p.currentStage.replace(/_/g, " ")}
              rows={[
                p.interconnectionQueueStage ? ["Queue stage", p.interconnectionQueueStage] : null,
                p.queueCluster ? ["Queue cluster", p.queueCluster] : null,
                p.reviewStep ? ["Review step", `${p.reviewStep}${p.reviewStepAt ? ` (since ${new Date(p.reviewStepAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })})` : ""}`] : null,
              ]}
            />
          )}
          {p.applicationFiledDate && (
            <Detail
              label="Filed"
              value={`${new Date(p.applicationFiledDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}${p.dateConfidence === "approximate" ? " (estimated)" : ""}`}
            />
          )}
          {p.balancingAuthority ? (
            <Detail
              label="Grid region"
              value={p.balancingAuthority}
              rows={[p.pointOfInterconnection ? ["Point of interconnection", p.pointOfInterconnection] : null]}
            />
          ) : p.pointOfInterconnection ? (
            <Detail label="Point of interconnection" value={p.pointOfInterconnection} />
          ) : null}
          {(p.netSummerCapacityMw != null || p.netWinterCapacityMw != null) && (
            <Detail
              label="Net capacity"
              value={p.netSummerCapacityMw != null ? `${p.netSummerCapacityMw.toLocaleString("en-US")} MW summer` : `${p.netWinterCapacityMw!.toLocaleString("en-US")} MW winter`}
              rows={[p.netSummerCapacityMw != null && p.netWinterCapacityMw != null ? ["Winter", `${p.netWinterCapacityMw.toLocaleString("en-US")} MW`] : null]}
            />
          )}
          {p.primeMoverCode && <Detail label="Equipment" value={PRIME_MOVER_LABELS[p.primeMoverCode] ?? p.primeMoverCode} />}
          {p.expectedOnlineDate && (
            <Detail
              label="Expected online"
              value={`${new Date(p.expectedOnlineDate).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" })}${p.expectedOnlineDateConfidence === "approximate" ? "*" : ""}`}
            />
          )}
          {p.currentStatus && <Detail wide label="Current status" value={withoutDashes(p.currentStatus)} />}
          {!resolved && p.causeDetail && (
            <Detail
              wide
              label={causeLabels.length > 0 ? `Why it's waiting: ${causeLabels.join(", ")}` : "Why it's waiting"}
              value={withoutDashes(p.causeDetail)}
            />
          )}
          {p.networkUpgradeCostUsd != null && (
            <Detail
              wide
              label="Estimated interconnection cost"
              value={formatUsd((p.poiCostUsd ?? 0) + p.networkUpgradeCostUsd)}
              rows={[
                p.poiCostUsd != null
                  ? ["Breakdown", `${formatUsd(p.poiCostUsd)} point of interconnection + ${formatUsd(p.networkUpgradeCostUsd)} network upgrade`]
                  : null,
                ["Source", "LBNL interconnection cost research. LBNL calls these estimates preliminary."],
              ]}
            />
          )}
        </div>
        {p.expectedOnlineDateConfidence === "approximate" && p.expectedOnlineDate && (
          <p className="mt-2 text-xs text-[var(--muted)]">* Approximate / developer-estimated date, not a firm commitment.</p>
        )}
    </>
  );
  const timelineContent =
    p.milestones.length > 0 ? (
      <>
          <ul className="flex flex-col gap-3">
            {p.milestones.map((m, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <div className="w-24 shrink-0 tabular-nums text-[var(--muted)]">
                  {new Date(m.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  {m.dateConfidence === "approximate" && <span className="text-xs">*</span>}
                </div>
                <div>
                  <span className="font-medium">{m.description}</span>
                  <span className="text-[var(--muted)]"> · {m.stage}</span>
                </div>
              </li>
            ))}
          </ul>
          {p.milestones.some((m) => m.dateConfidence === "approximate") && (
            <p className="text-xs text-[var(--muted)] mt-3">* Approximate date.</p>
          )}
      </>
    ) : (
      <p className="text-sm text-[var(--text-secondary)]">No milestones recorded yet.</p>
    );
  const sections: PillSection[] = [
    { id: "details", label: "Details", content: detailsContent },
    ...(p.milestones.length > 0 || outcome === "pending" ? [{ id: "timeline", label: "Timeline", content: timelineContent }] : []),
    {
      id: "take-action",
      label: resolved ? "Official record" : "Advocate",
      content: <TakeActionSection project={p} nowMs={nowMs} resolved={resolved} />,
    },
  ];

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
          numbers and is excluded from this site&rsquo;s aggregate headline stats.
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

      {outcome !== "pending" && (
        <OutcomeBanner
          project={p}
          outcome={outcome}
          observedAt={observed ? observed.createdAt.toISOString() : null}
          stats={resolved ? primaryCards : undefined}
        />
      )}

      {!resolved && (
        <div
          className={`grid gap-2 sm:gap-3 ${primaryCards.length === 1 ? "sm:max-w-xs" : ""}`}
          style={{ gridTemplateColumns: `repeat(${primaryCards.length}, minmax(0, 1fr))` }}
        >
          {primaryCards.map((c) => (
            <PrimaryStat key={c.label} {...c} />
          ))}
        </div>
      )}

      <SectionPills sections={sections} />

      <section id="comments" className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 scroll-mt-4">
        <ProjectDiscussion projectId={p.id} />
      </section>
    </div>
  );
}

// The three headline numbers: filled and larger than the secondary Stat
// cards so they read first.
function PrimaryStat({
  label,
  value,
  href,
  note,
  help,
}: {
  label: string;
  value: string;
  href?: string;
  note?: string;
  help?: string;
}) {
  return (
    <div title={help} className="rounded-xl bg-[var(--accent)] text-white p-3 sm:p-4 flex flex-col justify-between min-w-0">
      <div className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-white/75 whitespace-pre-line sm:whitespace-normal">
        {href ? (
          <Link href={href} className="hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </div>
      {/* Longer text like "Not disclosed" is set smaller on phones so it wraps between words, not inside one. */}
      <div className={`${value.length > 9 ? "text-base" : value.length > 7 ? "text-lg whitespace-nowrap" : "text-xl"} sm:text-3xl font-bold tabular-nums mt-1`}>{value}</div>
      {note && (
        <div title={note} className="text-[10px] leading-snug text-white/75 mt-1 line-clamp-2">
          {note}
        </div>
      )}
    </div>
  );
}

// One labeled item in the details panel. Extra facts about the same thing
// (queue stage, point of interconnection) sit under it as label and value
// pairs, so every item reads the same way.
function Detail({ label, value, rows, wide }: { label: string; value: string; rows?: ([string, string] | null)[]; wide?: boolean }) {
  const pairs = (rows ?? []).filter((r): r is [string, string] => r != null);
  return (
    <div className={`border-l-2 border-[var(--accent)] pl-3 min-w-0 ${wide ? "col-span-full" : ""}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className={`text-sm mt-0.5 break-words ${wide ? "text-[var(--text-secondary)] leading-snug" : "font-semibold"}`}>{value}</div>
      {pairs.map(([k, v]) => (
        <div key={k} className="text-xs mt-1 leading-snug break-words">
          <span className="text-[var(--muted)]">{k}: </span>
          <span className="font-medium text-[var(--text-secondary)]">{v}</span>
        </div>
      ))}
    </div>
  );
}
