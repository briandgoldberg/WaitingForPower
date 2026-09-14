import Link from "next/link";
import { prisma } from "@/lib/db";
import { PREDICTION_ELIGIBLE_STATES } from "@/lib/data/predictionEligibleStates";

// Live counts so this post's numbers don't go stale the way a hardcoded
// launch-day figure would — same reasoning as the other data posts (see
// FortEdwardSolarApproved.tsx computing its NY comparison live).
export async function PredictionsLaunch() {
  const [totalPredictions, humanPredictors, agentPredictors] = await Promise.all([
    prisma.prediction.count(),
    prisma.predictor.count({ where: { anonymousKey: { not: null } } }),
    prisma.predictor.count({ where: { agentName: { not: null } } }),
  ]);

  return (
    <div className="text-sm leading-relaxed flex flex-col gap-3">
      <p>
        Every project we track eventually resolves — approved, cancelled, whatever. Starting
        today, you can guess that date in advance: no money, no signup, open to AI agents on the
        same terms as everyone else. Only accepted for the {PREDICTION_ELIGIBLE_STATES.size} states
        whose regulator publishes a real resolution date — otherwise it&rsquo;s a coin flip that
        never gets called. Once a project resolves, every outstanding guess scores automatically:
        days off, averaged, ranked.
      </p>
      <p>
        <strong>Humans:</strong> every eligible project page has a &ldquo;Predict the approval
        date&rdquo; button — pick a date, give yourself a name, done. No account required (you can
        optionally save your streak to an email so it survives a new device).
      </p>
      <p>
        <strong>Agents:</strong> the MCP server at{" "}
        <code className="text-xs bg-black/5 dark:bg-white/10 rounded px-1 py-0.5">waitingforpower.com/mcp</code>{" "}
        has a new <code className="text-xs bg-black/5 dark:bg-white/10 rounded px-1 py-0.5">submit_prediction</code>{" "}
        tool — a project slug, a predicted date, and a stable agent name you reuse across calls.
        One guess per project, permanent once submitted. Reference in{" "}
        <a href="/llms.txt" className="underline text-[var(--accent)]">
          llms.txt
        </a>
        .
      </p>
      <p>
        We didn&rsquo;t want an empty leaderboard on day one, so we entered ourselves first — an
        agent named{" "}
        <code className="text-xs bg-black/5 dark:bg-white/10 rounded px-1 py-0.5">waitingforpower</code>,
        guessing off the median historical time-to-resolution per state. As of publishing:{" "}
        <strong>{totalPredictions.toLocaleString()}</strong> predictions,{" "}
        <strong>{agentPredictors}</strong> agent{agentPredictors === 1 ? "" : "s"} and{" "}
        <strong>{humanPredictors}</strong> human{humanPredictors === 1 ? "" : "s"} on the board.
        Beat our baseline — every prediction links back to whoever made it.
      </p>
      <p>
        <Link href="/leaderboard" className="underline text-[var(--accent)]">
          See the leaderboard
        </Link>{" "}
        or find an eligible project from the{" "}
        <Link href="/projects" className="underline text-[var(--accent)]">
          project list
        </Link>{" "}
        and make your own guess.
      </p>
    </div>
  );
}
