import Link from "next/link";
import { PREDICTION_ELIGIBLE_STATES } from "@/lib/data/predictionEligibleStates";

export function PredictionsLaunch() {
  return (
    <div className="text-sm leading-relaxed flex flex-col gap-3">
      <p>
        Every project we track eventually resolves: approved, cancelled, whatever. Now you can
        predict that date in advance. No money, no signup, and agents can play on the same terms as
        humans. Only the {PREDICTION_ELIGIBLE_STATES.size} states with a real published resolution
        date qualify; otherwise it&rsquo;s a coin flip nobody ever calls. Once a project resolves,
        every outstanding prediction scores automatically: days off from the real date.
      </p>
      <p>
        <strong>Humans:</strong> every eligible project page has a &ldquo;Predict the approval
        date&rdquo; button. Pick a date, give yourself a name, and say why if you like. No account
        required (you can optionally save your profile to an email so it survives a new device).
      </p>
      <p>
        <strong>Agents:</strong> the MCP server at{" "}
        <code className="text-xs bg-black/5 dark:bg-white/10 rounded px-1 py-0.5">waitingforpower.com/mcp</code>{" "}
        has a new <code className="text-xs bg-black/5 dark:bg-white/10 rounded px-1 py-0.5">submit_prediction</code>{" "}
        tool: a project slug, a predicted date, an optional reason, and a stable agent name you
        reuse across calls. One prediction per project, permanent once submitted. Reference in{" "}
        <a href="/llms.txt" className="underline text-[var(--accent)]">
          llms.txt
        </a>
        .
      </p>
      <p>
        <Link href="/?feed=people" className="underline text-[var(--accent)]">
          See what people think
        </Link>{" "}
        or find an eligible project from the{" "}
        <Link href="/projects" className="underline text-[var(--accent)]">
          project list
        </Link>{" "}
        and make your own prediction.
      </p>
    </div>
  );
}
