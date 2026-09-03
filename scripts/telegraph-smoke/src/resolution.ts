import type { ActionDecision, ActionDecisionValue } from "./action-policy.js";
import type { EvidenceAssessment, EvidenceQuality } from "./types.js";
import type { PlannedRequirement } from "./planner.js";

/**
 * Machine-readable reason code for an unresolved requirement.
 */
export type ResolutionReasonCode =
  | "FRAUD_EVIDENCE_MISSING"
  | "FRAUD_EVIDENCE_BELOW_REQUIRED_QUALITY"
  | "FRAUD_EVIDENCE_CONTRADICTED"
  | "URL_EVIDENCE_MISSING"
  | "URL_EVIDENCE_BELOW_REQUIRED_QUALITY"
  | "URL_EVIDENCE_CONTRADICTED"
  | "ONCHAIN_EVIDENCE_MISSING"
  | "ONCHAIN_EVIDENCE_BELOW_REQUIRED_QUALITY"
  | "ONCHAIN_EVIDENCE_CONTRADICTED"
  | "BLOCKING_ADVERSE_FRAUD_EVIDENCE"
  | "UNKNOWN_REQUIREMENT_UNMET";

export interface UnresolvedCondition {
  reasonCode: ResolutionReasonCode;
  /** Short machine name of the unmet condition (e.g. "FRAUD_EVIDENCE_USABLE"). */
  requiredCondition: string;
  /** Human-facing sentence describing what is unresolved. */
  description: string;
  /** Human-facing sentence describing what must change for the decision to move forward. */
  required: string;
}

export interface DecisionResolution {
  /** The decision this guidance is derived from. */
  decision: ActionDecisionValue;
  /**
   * Whether resolution guidance is present. ALLOW decisions have no
   * unresolved conditions; REVIEW and BLOCK decisions always list at least one.
   */
  resolved: boolean;
  unresolvedConditions: UnresolvedCondition[];
  /** Short human-readable outcome label. */
  outcomeLabel: string;
}

const QUALITY_RANK: Partial<Record<EvidenceQuality, number>> = {
  INVALID: 0,
  CONTRADICTED: 1,
  INSUFFICIENT: 2,
  LIMITED: 3,
  USABLE: 4,
  STRONG: 5,
};

function qualityMeetsMinimum(quality: EvidenceQuality, minimum: "USABLE" | "STRONG"): boolean {
  const required = QUALITY_RANK[minimum] ?? 4;
  return (QUALITY_RANK[quality] ?? 0) >= required;
}

function intentPrefix(intent: string): string {
  if (intent === "FRAUD_DETECTION") return "FRAUD";
  if (intent === "URL_SCAN") return "URL";
  if (intent === "ONCHAIN_TX_LOOKUP") return "ONCHAIN";
  return intent;
}

function codeFor(intent: string, suffix: string): ResolutionReasonCode {
  const prefix = intentPrefix(intent);
  const candidate = `${prefix}_EVIDENCE_${suffix}`;
  // Narrow to known codes, fall back to UNKNOWN if unrecognised
  const known: ResolutionReasonCode[] = [
    "FRAUD_EVIDENCE_MISSING", "FRAUD_EVIDENCE_BELOW_REQUIRED_QUALITY", "FRAUD_EVIDENCE_CONTRADICTED",
    "URL_EVIDENCE_MISSING", "URL_EVIDENCE_BELOW_REQUIRED_QUALITY", "URL_EVIDENCE_CONTRADICTED",
    "ONCHAIN_EVIDENCE_MISSING", "ONCHAIN_EVIDENCE_BELOW_REQUIRED_QUALITY", "ONCHAIN_EVIDENCE_CONTRADICTED",
    "BLOCKING_ADVERSE_FRAUD_EVIDENCE", "UNKNOWN_REQUIREMENT_UNMET",
  ];
  return (known.includes(candidate as ResolutionReasonCode) ? candidate : "UNKNOWN_REQUIREMENT_UNMET") as ResolutionReasonCode;
}

const HUMAN_LABEL: Record<ActionDecisionValue, string> = {
  ALLOW: "Authorization approved",
  REVIEW: "Payment authorization held",
  BLOCK: "Authorization rejected",
};

/**
 * Derives deterministic resolution guidance from the evidence requirement plan,
 * assessed evidence, and the action decision.
 *
 * No LLM. No fabricated certainty. Every sentence is derived from the
 * policy requirements and the measured evidence state.
 */
export function deriveResolution(
  decision: ActionDecision,
  requirements: readonly PlannedRequirement[],
  assessments: readonly EvidenceAssessment[],
): DecisionResolution {
  const unresolvedConditions: UnresolvedCondition[] = [];

  if (decision.decision === "ALLOW") {
    return { decision: "ALLOW", resolved: true, unresolvedConditions: [], outcomeLabel: HUMAN_LABEL.ALLOW };
  }

  // BLOCK — locate blocking evidence and map to conditions
  if (decision.decision === "BLOCK") {
    for (const ref of decision.blockingEvidence) {
      const intent = ref.split(":")[0] ?? "UNKNOWN";
      unresolvedConditions.push({
        reasonCode: "BLOCKING_ADVERSE_FRAUD_EVIDENCE",
        requiredCondition: `${intentPrefix(intent)}_NO_ADVERSE_FINDING`,
        description: "Evidence contains a verified adverse finding that triggers a block.",
        required: "The blocking evidence must be independently reviewed and refuted before the action can proceed.",
      });
    }
    return { decision: "BLOCK", resolved: false, unresolvedConditions, outcomeLabel: HUMAN_LABEL.BLOCK };
  }

  // REVIEW — iterate requirements and diagnose each unsatisfied one
  for (const req of requirements) {
    if (!req.mandatory) continue;
    if (decision.satisfiedRequirements.some((id) =>
      // satisfied requirements use policy IDs; match by intent
      assessments.some((a) => a.intent === req.intent && decision.satisfiedRequirements.length > 0)
    )) {
      // Check if this intent is actually in unsatisfied list
      if (!decision.reviewEvidence.some((ref) => ref.startsWith(req.intent))) continue;
    }

    const matching = assessments.filter((a) => a.intent === req.intent);

    if (matching.length === 0) {
      unresolvedConditions.push({
        reasonCode: codeFor(req.intent, "MISSING"),
        requiredCondition: `${intentPrefix(req.intent)}_EVIDENCE_${req.minimumQuality}`,
        description: humanMissing(req.intent),
        required: humanRequired(req.intent, req.minimumQuality),
      });
      continue;
    }

    const contradicted = matching.find((a) => a.quality === "CONTRADICTED" || a.verification === "CONTRADICTED");
    if (contradicted) {
      unresolvedConditions.push({
        reasonCode: codeFor(req.intent, "CONTRADICTED"),
        requiredCondition: `${intentPrefix(req.intent)}_EVIDENCE_UNCONTRADICTED`,
        description: humanContradicted(req.intent),
        required: humanResolveContradiction(req.intent),
      });
      continue;
    }

    const belowQuality = matching.some((a) => !qualityMeetsMinimum(a.quality, req.minimumQuality));
    if (belowQuality) {
      unresolvedConditions.push({
        reasonCode: codeFor(req.intent, "BELOW_REQUIRED_QUALITY"),
        requiredCondition: `${intentPrefix(req.intent)}_EVIDENCE_${req.minimumQuality}`,
        description: humanBelowQuality(req.intent),
        required: humanRequired(req.intent, req.minimumQuality),
      });
    }
  }

  // Deduplicate by reasonCode
  const seen = new Set<string>();
  const deduped = unresolvedConditions.filter((c) => {
    const key = `${c.reasonCode}:${c.requiredCondition}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { decision: "REVIEW", resolved: false, unresolvedConditions: deduped, outcomeLabel: HUMAN_LABEL.REVIEW };
}

function humanMissing(intent: string): string {
  if (intent === "FRAUD_DETECTION") return "Fraud coverage is incomplete. No fraud assessment was returned.";
  if (intent === "URL_SCAN") return "The supplier URL has not been assessed. No scan result was returned.";
  if (intent === "ONCHAIN_TX_LOOKUP") return "The referenced transaction could not be verified. No on-chain result was returned.";
  return "A required evidence domain is missing.";
}

function humanRequired(intent: string, quality: string): string {
  if (intent === "FRAUD_DETECTION") return `Nexora needs stronger fraud evidence before this action can proceed. A ${quality.toLowerCase()} fraud assessment is required.`;
  if (intent === "URL_SCAN") return `Nexora needs a clear URL assessment before this action can proceed. A ${quality.toLowerCase()} URL scan is required.`;
  if (intent === "ONCHAIN_TX_LOOKUP") return `Nexora needs verified on-chain context before this action can proceed. A ${quality.toLowerCase()} transaction lookup is required.`;
  return `A ${quality.toLowerCase()} evidence assessment is required.`;
}

function humanContradicted(intent: string): string {
  if (intent === "FRAUD_DETECTION") return "The fraud assessment conflicts with independently verified information.";
  if (intent === "URL_SCAN") return "The URL scan result conflicts with independently verified information.";
  if (intent === "ONCHAIN_TX_LOOKUP") return "The transaction result conflicts with independently verified evidence.";
  return "An evidence assessment is contradicted by independent verification.";
}

function humanResolveContradiction(intent: string): string {
  if (intent === "FRAUD_DETECTION") return "The contradiction in the fraud assessment must be resolved before the action can proceed.";
  if (intent === "URL_SCAN") return "The contradiction in the URL assessment must be resolved before the action can proceed.";
  if (intent === "ONCHAIN_TX_LOOKUP") return "The discrepancy between the provider report and on-chain reality must be resolved.";
  return "The contradiction in the evidence must be resolved before the action can proceed.";
}

function humanBelowQuality(intent: string): string {
  if (intent === "FRAUD_DETECTION") return "Fraud coverage is incomplete. The available fraud assessment does not meet the required quality.";
  if (intent === "URL_SCAN") return "The URL assessment does not meet the required quality for this action.";
  if (intent === "ONCHAIN_TX_LOOKUP") return "The on-chain evidence does not meet the required quality for this action.";
  return "An evidence assessment does not meet the required quality.";
}
