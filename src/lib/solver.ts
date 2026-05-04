import { detectIssues, type Warning } from "./algorithms";
import {
  applyProposal,
  proposalsForWarning,
  type Proposal,
} from "./proposals";
import type { Course, Placement } from "./types";

export interface SolveResult {
  finalPlacement: Placement;
  appliedProposals: Proposal[];
  remainingErrors: Warning[];
  iterations: number;
  reason: "converged" | "max-iterations" | "no-progress";
}

const MAX_ITERATIONS = 12;

function countErrors(warnings: Warning[]): number {
  return warnings.filter((w) => w.level === "error").length;
}

function countTotalIssues(warnings: Warning[]): number {
  return warnings.length;
}

/**
 * Score a placement: lower = better.
 * - Each error costs 100
 * - Each warning costs 5
 * - Each info costs 1
 */
function scorePlacement(courses: Course[], placement: Placement): number {
  const warnings = detectIssues(courses, placement);
  let score = 0;
  for (const w of warnings) {
    if (w.level === "error") score += 100;
    else if (w.level === "warning") score += 5;
    else score += 1;
  }
  return score;
}

/**
 * Iteratively solve placement issues.
 *
 * Strategy:
 * 1. Detect errors only (skip info/warning unless asked)
 * 2. For each error, generate proposals on current state (not stale)
 * 3. Score each proposal by simulating it: pick the one with lowest resulting score
 * 4. If best proposal doesn't reduce errors, skip
 * 5. Apply, re-detect, repeat until converged or max iterations
 */
export function solveIssues(
  courses: Course[],
  initialPlacement: Placement,
  options: { includeWarnings?: boolean } = {},
): SolveResult {
  let placement = { ...initialPlacement };
  const appliedProposals: Proposal[] = [];
  let iterations = 0;
  let reason: SolveResult["reason"] = "max-iterations";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterations++;
    const warnings = detectIssues(courses, placement);
    const targets = options.includeWarnings
      ? warnings.filter((w) => w.level !== "info")
      : warnings.filter((w) => w.level === "error");

    if (targets.length === 0) {
      reason = "converged";
      break;
    }

    const currentScore = scorePlacement(courses, placement);
    const seen = new Set<string>();
    let bestProposal: Proposal | null = null;
    let bestScore = currentScore;
    let bestNext: Placement | null = null;

    for (const warning of targets) {
      const proposals = proposalsForWarning(warning, { courses, placement });
      for (const proposal of proposals) {
        const key = JSON.stringify(proposal.actions);
        if (seen.has(key)) continue;
        seen.add(key);

        const next = applyProposal(placement, proposal.actions);
        const nextScore = scorePlacement(courses, next);

        if (nextScore < bestScore) {
          bestScore = nextScore;
          bestProposal = proposal;
          bestNext = next;
        }
      }
    }

    if (!bestProposal || !bestNext) {
      reason = "no-progress";
      break;
    }

    placement = bestNext;
    appliedProposals.push(bestProposal);
  }

  const finalWarnings = detectIssues(courses, placement);
  const remainingErrors = finalWarnings.filter((w) => w.level === "error");

  return {
    finalPlacement: placement,
    appliedProposals,
    remainingErrors,
    iterations,
    reason,
  };
}

void countErrors;
void countTotalIssues;
