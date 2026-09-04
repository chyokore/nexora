import type { EvidenceAssessment, InvestigationVerdict } from "./types.js";
import type { PlannedRequirement } from "./planner.js";

/**
 * Investigation verdict policy — separate from ActionPolicy (ALLOW/REVIEW/BLOCK).
 *
 * Evaluates evidence assessments against planned requirements and returns:
 *   SUPPORTED    — all mandatory requirements are satisfied at or above minimum quality
 *   DISPUTED     — any requirement has contradicted or verified-adverse evidence
 *   INCONCLUSIVE — mandatory evidence is missing, insufficient, or below minimum quality
 */

export interface InvestigationDecision {
  verdict: InvestigationVerdict;
  reasons: string[];
  satisfiedRequirements: string[];
  unsatisfiedRequirements: string[];
  disputedRequirements: string[];
}

const TRUSTED_QUALITY_RANK: Partial<Record<string, number>> = {
  USABLE: 1,
  STRONG: 2,
};

const MINIMUM_RANK: Record<"USABLE" | "STRONG", number> = { USABLE: 1, STRONG: 2 };
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort();

export function evaluateInvestigationPolicy(
  requirements: PlannedRequirement[],
  assessments: readonly EvidenceAssessment[]
): InvestigationDecision {
  const satisfied: string[] = [];
  const unsatisfied: string[] = [];
  const disputed: string[] = [];
  const reasons: string[] = [];

  for (const req of requirements) {
    const matching = assessments.filter((a) => a.intent === req.intent);

    // Contradicted evidence → DISPUTED
    const contradicted = matching.find(
      (a) => a.verification === "CONTRADICTED" || a.quality === "CONTRADICTED"
    );
    if (contradicted) {
      disputed.push(req.id ?? req.intent);
      reasons.push(`disputed:${req.id ?? req.intent}:contradicted_evidence`);
      continue;
    }

    if (!req.mandatory) {
      satisfied.push(req.id ?? req.intent);
      reasons.push(`optional:${req.id ?? req.intent}`);
      continue;
    }

    if (matching.length === 0) {
      unsatisfied.push(req.id ?? req.intent);
      reasons.push(`inconclusive:${req.id ?? req.intent}:missing_evidence`);
      continue;
    }

    const minRank = MINIMUM_RANK[req.minimumQuality];
    const qualifying = matching.find(
      (a) => (TRUSTED_QUALITY_RANK[a.quality] ?? 0) >= minRank
    );

    if (qualifying) {
      satisfied.push(req.id ?? req.intent);
      reasons.push(`satisfied:${req.id ?? req.intent}:${qualifying.quality}`);
    } else {
      unsatisfied.push(req.id ?? req.intent);
      reasons.push(`inconclusive:${req.id ?? req.intent}:quality_below_${req.minimumQuality}`);
    }
  }

  // No requirements at all → INCONCLUSIVE (nothing to evaluate)
  if (requirements.length === 0) {
    reasons.push("inconclusive:no_routable_requirements");
  }

  const verdict: InvestigationVerdict =
    disputed.length > 0
      ? "DISPUTED"
      : unsatisfied.length > 0 || requirements.length === 0
      ? "INCONCLUSIVE"
      : "SUPPORTED";

  reasons.push(`verdict:${verdict.toLowerCase()}`);

  return {
    verdict,
    reasons: sortedUnique(reasons),
    satisfiedRequirements: sortedUnique(satisfied),
    unsatisfiedRequirements: sortedUnique(unsatisfied),
    disputedRequirements: sortedUnique(disputed),
  };
}
