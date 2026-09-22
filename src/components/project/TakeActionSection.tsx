import type { ProjectDTO } from "@/lib/types";
import { splitStateCodes, stateName } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { isPublicHearing, ruleForState, commentScore, commentStatusText } from "@/lib/advocacyActions";

const MAX_STATES_SHOWN = 4;

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

// One of the three equal sections in Take action, styled like the details
// panel above it.
function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[var(--accent)] pl-3 min-w-0">
      <h3 className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)] mb-1">{title}</h3>
      {children}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
      {children}
    </a>
  );
}

// The content of the Take action pill: the official docket, who regulates
// it, and upcoming hearings and comment windows (or, for a project that
// already has its answer, just the docket and regulators).
export function TakeActionSection({ project: p, nowMs, resolved }: { project: ProjectDTO; nowMs: number; resolved: boolean }) {
  const primarySource = p.sources[0];
  const regulatorStates = splitStateCodes(p.state)
    .filter((code) => STATE_REGULATORS[code])
    .slice(0, MAX_STATES_SHOWN);
  // Same scoring the Advocate > Projects tab uses, so a project reads the
  // same way in both places — see src/lib/advocacyActions.ts.
  const rule = ruleForState(p.state);
  const score = commentScore({ commentDeadline: p.commentDeadline, reviewStep: p.reviewStep, hearingCount: p.hearings.length }, rule);

  const docketColumn = (
    <Column title="Official docket">
      {primarySource ? (
        <p className="text-sm">
          <ExternalLink href={primarySource.url}>{primarySource.label}</ExternalLink>
        </p>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">Not available.</p>
      )}
      <p className="text-xs text-[var(--muted)] mt-1">{resolved ? "The official filings for this project." : "Read the filings and file a public comment where the regulator allows it."}</p>
    </Column>
  );
  const contactColumn = (
    <Column title="Who to contact">
      {regulatorStates.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm">
          {regulatorStates.flatMap((code) =>
            STATE_REGULATORS[code].map((r) => (
              <li key={`${code}-${r.name}`}>
                <span className="font-medium">{r.name}</span>
                {regulatorStates.length > 1 && <span className="text-[var(--muted)]"> ({stateName(code)})</span>}
                <div className="text-xs flex gap-3 mt-0.5">
                  <ExternalLink href={r.website}>Website</ExternalLink>
                  {r.contactUrl && <ExternalLink href={r.contactUrl}>Contact</ExternalLink>}
                </div>
              </li>
            )),
          )}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">No state regulator on file for this project.</p>
      )}
    </Column>
  );

  // A project that already has its answer has no hearings or comment window
  // to act on, so it gets a plain reference block instead of Take action.
  if (resolved) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {docketColumn}
        {contactColumn}
      </div>
    );
  }

  return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {docketColumn}

        {contactColumn}

        <Column title="Comments and hearings">
          <p className="text-sm font-medium">{commentStatusText(score, p.commentDeadline)}</p>
          {rule?.commentUrl && (
            <p className="text-sm mt-1">
              <ExternalLink href={rule.commentUrl}>How to comment</ExternalLink>
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <h4 className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)] mb-1">Hearings</h4>
            {p.hearings.length > 0 ? (
              <ul className="flex flex-col gap-2.5 text-sm text-[var(--text-secondary)]">
                {p.hearings.map((h, i) => {
                  const past = new Date(h.endDate ?? h.date).getTime() < nowMs;
                  return (
                    <li key={i} className={past ? "opacity-60" : undefined}>
                      <div>
                        {fmt(h.date)}
                        {h.endDate && ` – ${fmt(h.endDate)}`}
                        {h.label && <span className="text-[var(--muted)]"> · {h.label}</span>}
                        {h.label && (
                          <span className={isPublicHearing(h) ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
                            {" "}
                            · {isPublicHearing(h) ? "public can speak" : "parties only"}
                          </span>
                        )}
                        {past && <span className="text-[var(--muted)]"> · past</span>}
                      </div>
                      {h.location && <div className="text-xs text-[var(--muted)] mt-0.5">Where: {h.location}</div>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No hearing dates on file yet.</p>
            )}
            {p.hearingDetailsLink && (
              <p className="text-sm mt-2">
                {/^https?:\/\//.test(p.hearingDetailsLink) ? (
                  <ExternalLink href={p.hearingDetailsLink}>Hearing details</ExternalLink>
                ) : (
                  <>
                    <span className="text-[var(--muted)]">Hearing details: </span>
                    {p.hearingDetailsLink}
                  </>
                )}
              </p>
            )}
            <p className="text-xs text-[var(--muted)] mt-1">
              {p.hearings.length > 0 || p.hearingDetailsLink ? "Pulled from this project’s docket source." : "Check the docket directly for hearing dates."}
            </p>
          </div>
        </Column>
      </div>
  );
}
