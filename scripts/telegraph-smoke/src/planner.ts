import type { DiscoveryIntent } from "./types.js";
import type { ProposedAction } from "./action-policy.js";

/**
 * A single evidence requirement produced by the deterministic planner.
 * Each requirement identifies the Telegraph intent to acquire, whether it is
 * mandatory, the minimum acceptable quality, a machine reason code, and a
 * human-facing rationale.
 */
export interface PlannedRequirement {
  intent: DiscoveryIntent;
  mandatory: boolean;
  minimumQuality: "USABLE" | "STRONG";
  reasonCode: string;
  rationale: string;
  condition: string;
}

export interface EvidenceRequirementPlan {
  actionType: ProposedAction["type"];
  riskClass: ProposedAction["riskClass"];
  requirements: PlannedRequirement[];
}

/**
 * Deterministic evidence requirement planner.
 *
 * Maps a proposed action to the Telegraph intents required to support a
 * bounded decision. No LLM, no network call, no randomness. The same action
 * always produces the same plan.
 *
 * Conditional requirements apply only when the relevant subject field is
 * present.
 */
export function planEvidenceRequirements(action: ProposedAction): EvidenceRequirementPlan {
  const requirements: PlannedRequirement[] = [
    {
      intent: "FRAUD_DETECTION",
      mandatory: true,
      minimumQuality: "USABLE",
      reasonCode: "FRAUD_EVIDENCE_REQUIRED",
      rationale: "Fraud evidence is required before authorizing a supplier payment.",
      condition: "Always required for SUPPLIER_PAYMENT_AUTHORIZATION at HIGH risk class.",
    },
  ];

  if (action.subject.supplierUrl !== undefined) {
    requirements.push({
      intent: "URL_SCAN",
      mandatory: true,
      minimumQuality: "USABLE",
      reasonCode: "URL_EVIDENCE_REQUIRED",
      rationale: "The supplier destination must be checked before authorization.",
      condition: "Required when a supplier URL is present in the action subject.",
    });
  }

  if (action.subject.transactionHash !== undefined) {
    requirements.push({
      intent: "ONCHAIN_TX_LOOKUP",
      mandatory: true,
      minimumQuality: "USABLE",
      reasonCode: "ONCHAIN_EVIDENCE_REQUIRED",
      rationale: "A referenced transaction must be verified before authorization.",
      condition: "Required when a prior transaction hash is present in the action subject.",
    });
  }

  return {
    actionType: action.type,
    riskClass: action.riskClass,
    requirements: requirements.sort((a, b) => a.intent.localeCompare(b.intent)),
  };
}
