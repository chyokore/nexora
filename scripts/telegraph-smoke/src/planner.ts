import type { DiscoveryIntent } from "./types.js";
import type { ProposedAction } from "./action-policy.js";

/**
 * A single evidence requirement produced by the deterministic planner.
 * Each requirement identifies the Telegraph intent to acquire, whether it is
 * mandatory, the minimum acceptable quality, a machine reason code, and a
 * human-facing rationale.
 */
export interface PlannedRequirement {
  id?: string;
  question?: string;
  whyItMatters?: string;
  intent: DiscoveryIntent;
  mandatory: boolean;
  minimumQuality: "USABLE" | "STRONG";
  reasonCode: string;
  rationale: string;
  condition: string;
}

export interface EvidenceRequirementPlan {
  userQuestion: string;
  actionType: ProposedAction["type"];
  riskClass: ProposedAction["riskClass"];
  requirements: PlannedRequirement[];
}

export const DEFAULT_USER_QUESTION = "Is there enough reliable evidence for my agent to authorize this supplier payment?";

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
export function planEvidenceRequirements(action: ProposedAction, customUserQuestion?: string): EvidenceRequirementPlan {
  const userQuestion = customUserQuestion?.trim() || DEFAULT_USER_QUESTION;

  const requirements: PlannedRequirement[] = [
    {
      id: "req-fraud-detection",
      question: "Are there credible fraud indicators associated with this supplier or payment request?",
      whyItMatters: "A verified fraud signal could make the requested action unsafe to authorize.",
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
      id: "req-url-scan",
      question: "Does the supplied URL show signs of phishing, malware, or known malicious activity?",
      whyItMatters: "The supplier URL is part of the evidence supporting the request, so its safety affects whether the agent can rely on it.",
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
      id: "req-onchain-tx",
      question: "Does the referenced transaction exist on the claimed network and match the information provided?",
      whyItMatters: "The request relies on an onchain claim that should be independently verifiable.",
      intent: "ONCHAIN_TX_LOOKUP",
      mandatory: true,
      minimumQuality: "USABLE",
      reasonCode: "ONCHAIN_EVIDENCE_REQUIRED",
      rationale: "A referenced transaction must be verified before authorization.",
      condition: "Required when a prior transaction hash is present in the action subject.",
    });
  }

  return {
    userQuestion,
    actionType: action.type,
    riskClass: action.riskClass,
    requirements: requirements.sort((a, b) => a.intent.localeCompare(b.intent)),
  };
}

