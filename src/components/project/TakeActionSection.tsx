import type { ProjectDTO } from "@/lib/types";
import { splitStateCodes, stateName } from "@/lib/data/usStates";
import { STATE_REGULATORS } from "@/lib/data/stateRegulators";

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

// What someone needs to act on a project: the official docket, who
// regulates it, and upcoming hearings and comment windows. The discussion,
// including predictions, is at the bottom of the page.
export function TakeActionSection({ project: p, nowMs }: { project: ProjectDTO; nowMs: number }) {
  const primarySource = p.sources[0];
  const regulatorStates = splitStateCodes(p.state)
    .filter((code) => STATE_REGULATORS[code])
    .slice(0, MAX_STATES_SHOWN);

  return (
    <section id="take-action" className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5 flex flex-col gap-5">
      <h2 className="text-lg font-bold text-[var(--accent)]">Take action</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Column title="Official docket">
          {primarySource ? (
            <p className="text-sm">
              <ExternalLink href={primarySource.url}>{primarySource.label}</ExternalLink>
            </p>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Not available.</p>
          )}
          <p className="text-xs text-[var(--muted)] mt-1">Read the filings and file a public comment where the regulator allows it.</p>
        </Column>

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

        <Column title="Hearings and comment deadlines">
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
            {p.hearings.length > 0 || p.hearingDetailsLink
              ? "Pulled from this project’s docket source."
              : "Not available from this project’s data source yet. Check the docket directly."}
          </p>
        </Column>
      </div>
    </section>
  );
}
