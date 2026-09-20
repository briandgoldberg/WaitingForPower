import type { ProjectDTO } from "@/lib/types";
import { splitStateCodes, stateName } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";
import { PredictCard } from "@/components/PredictCard";
import { ProjectDiscussion } from "@/components/ProjectDiscussion";

const MAX_STATES_SHOWN = 4;

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
      {children}
    </a>
  );
}

// Everything someone needs to act on a project in one place: the official
// docket, who regulates it, upcoming hearings and comment windows, a
// prediction, and a public comment thread.
export function TakeActionSection({ project: p, canPredict, nowMs }: { project: ProjectDTO; canPredict: boolean; nowMs: number }) {
  const primarySource = p.sources[0];
  const regulatorStates = splitStateCodes(p.state)
    .filter((code) => STATE_REGULATORS[code])
    .slice(0, MAX_STATES_SHOWN);

  return (
    <section id="take-action" className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5 flex flex-col gap-5">
      <h2 className="text-lg font-bold text-[var(--accent)]">Take action</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-1.5">Official docket</h3>
          {primarySource ? (
            <p className="text-sm">
              <ExternalLink href={primarySource.url}>{primarySource.label}</ExternalLink>
            </p>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Not available.</p>
          )}
          <p className="text-xs text-[var(--muted)] mt-1">Read the filings and file a public comment where the regulator allows it.</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-1.5">Who to contact</h3>
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
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-1.5">Hearings and comment deadlines</h3>
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
                    {past && <span className="text-[var(--muted)]"> · past</span>}
                  </div>
                  {h.location && <div className="text-xs text-[var(--muted)] mt-0.5">Where: {h.location}</div>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">None on file.</p>
        )}
        <p className="text-sm mt-2">
          {p.hearingDetailsLink ? (
            /^https?:\/\//.test(p.hearingDetailsLink) ? (
              <ExternalLink href={p.hearingDetailsLink}>Hearing details</ExternalLink>
            ) : (
              <>
                <span className="text-[var(--muted)]">Hearing details: </span>
                {p.hearingDetailsLink}
              </>
            )
          ) : null}
        </p>
        <p className="text-xs text-[var(--muted)] mt-1">
          {p.hearings.length > 0 || p.hearingDetailsLink
            ? "Pulled from this project’s own docket source. Check the docket for the latest."
            : "Not available from this project’s data source yet. Check the docket directly."}
        </p>
      </div>

      {canPredict && <PredictCard projectId={p.id} />}

      <ProjectDiscussion projectId={p.id} />
    </section>
  );
}
