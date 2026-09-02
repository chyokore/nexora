import type { DiscoveryIntent, EvidenceAssessment, EvidenceQuality } from "./types.js";

export const ACTION_DECISIONS = ["ALLOW", "REVIEW", "BLOCK"] as const;
export type ActionDecisionValue = (typeof ACTION_DECISIONS)[number];

export interface ProposedAction {
  id: string;
  type: "SUPPLIER_PAYMENT_AUTHORIZATION";
  description: string;
  subject: {
    kind: "SUPPLIER_PAYMENT";
    reference: string;
    supplierUrl?: string;
    transactionHash?: string;
  };
  riskClass: "HIGH";
}

export interface EvidenceRequirement {
  id: string;
  intent: DiscoveryIntent;
  required: boolean;
  minimumQuality: "USABLE" | "STRONG";
  contradictionRule: "REVIEW" | "BLOCK";
  requiredFindings: string[];
  blockingFindings: string[];
}

export interface ActionPolicySnapshot {
  id: "supplier-payment-authorization-v1";
  version: 1;
  actionType: ProposedAction["type"];
  requirements: EvidenceRequirement[];
}

export interface ActionDecision {
  decision: ActionDecisionValue;
  reasons: string[];
  satisfiedRequirements: string[];
  unsatisfiedRequirements: string[];
  blockingEvidence: string[];
  reviewEvidence: string[];
}

const trustedQualityRank: Partial<Record<EvidenceQuality, number>> = { USABLE: 1, STRONG: 2 };
const minimumRank: Record<EvidenceRequirement["minimumQuality"], number> = { USABLE: 1, STRONG: 2 };
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort();

export function supplierPaymentPolicy(action: ProposedAction): ActionPolicySnapshot {
  const requirements: EvidenceRequirement[] = [
    { id: "fraud-assessment", intent: "FRAUD_DETECTION", required: true, minimumQuality: "USABLE", contradictionRule: "REVIEW", requiredFindings: ["FRAUD_SCREEN_CLEAR"], blockingFindings: ["FRAUD_CONFIRMED"] },
    { id: "supplier-url-assessment", intent: "URL_SCAN", required: action.subject.supplierUrl !== undefined, minimumQuality: "USABLE", contradictionRule: "REVIEW", requiredFindings: ["URL_CHECKS_CLEAR"], blockingFindings: ["MALICIOUS_URL_CONFIRMED"] },
  ];
  if (action.subject.transactionHash !== undefined) requirements.push({ id: "transaction-lookup", intent: "ONCHAIN_TX_LOOKUP", required: true, minimumQuality: "USABLE", contradictionRule: "REVIEW", requiredFindings: ["TRANSACTION_CONTEXT_VERIFIED"], blockingFindings: ["TRANSACTION_POLICY_VIOLATION_CONFIRMED"] });
  return { id: "supplier-payment-authorization-v1", version: 1, actionType: action.type, requirements: requirements.sort((a, b) => a.id.localeCompare(b.id)) };
}

function evidenceReference(assessment: EvidenceAssessment): string {
  return `${assessment.intent}:${assessment.quality}`;
}

export function evaluateActionPolicy(action: ProposedAction, assessments: readonly EvidenceAssessment[]): { policy: ActionPolicySnapshot; actionDecision: ActionDecision } {
  const policy = supplierPaymentPolicy(action);
  const satisfied: string[] = [], unsatisfied: string[] = [], blocking: string[] = [], review: string[] = [], reasons: string[] = [];

  for (const requirement of policy.requirements) {
    const matching = assessments.filter((assessment) => assessment.intent === requirement.intent);
    const explicitBlocking = matching.filter((assessment) => assessment.verification === "VERIFIED" && (assessment.quality === "STRONG" || assessment.quality === "USABLE") && assessment.findings.some((finding) => requirement.blockingFindings.includes(finding)));
    if (explicitBlocking.length > 0) {
      blocking.push(...explicitBlocking.map(evidenceReference));
      reasons.push(`blocking_rule:${requirement.id}:verified_adverse_finding`);
      continue;
    }
    if (!requirement.required) {
      satisfied.push(requirement.id);
      reasons.push(`optional_requirement:${requirement.id}`);
      continue;
    }
    if (matching.length === 0) {
      unsatisfied.push(requirement.id);
      review.push(`${requirement.intent}:MISSING`);
      reasons.push(`review:${requirement.id}:missing_required_evidence`);
      continue;
    }
    const contradicted = matching.find((assessment) => assessment.verification === "CONTRADICTED" || assessment.quality === "CONTRADICTED");
    if (contradicted) {
      if (requirement.contradictionRule === "BLOCK") {
        blocking.push(evidenceReference(contradicted));
        reasons.push(`blocking_rule:${requirement.id}:contradicted_evidence`);
      } else {
        unsatisfied.push(requirement.id);
        review.push(evidenceReference(contradicted));
        reasons.push(`review:${requirement.id}:contradicted_required_evidence`);
      }
      continue;
    }
    const qualityQualifying = matching.filter((assessment) => (trustedQualityRank[assessment.quality] ?? 0) >= minimumRank[requirement.minimumQuality]);
    const qualifying = qualityQualifying.find((assessment) => requirement.requiredFindings.every((finding) => assessment.findings.includes(finding)));
    if (qualifying) {
      satisfied.push(requirement.id);
      reasons.push(`satisfied:${requirement.id}:${qualifying.quality}`);
    } else {
      const best = [...matching].sort((a, b) => (trustedQualityRank[b.quality] ?? 0) - (trustedQualityRank[a.quality] ?? 0) || evidenceReference(a).localeCompare(evidenceReference(b)))[0];
      unsatisfied.push(requirement.id);
      review.push(best ? evidenceReference(best) : `${requirement.intent}:MISSING`);
      reasons.push(qualityQualifying.length > 0 ? `review:${requirement.id}:missing_required_finding` : `review:${requirement.id}:quality_below_${requirement.minimumQuality}`);
    }
  }

  const decision: ActionDecisionValue = blocking.length > 0 ? "BLOCK" : unsatisfied.length > 0 ? "REVIEW" : "ALLOW";
  reasons.push(`decision:${decision.toLowerCase()}`);
  return { policy, actionDecision: { decision, reasons: sortedUnique(reasons), satisfiedRequirements: sortedUnique(satisfied), unsatisfiedRequirements: sortedUnique(unsatisfied), blockingEvidence: sortedUnique(blocking), reviewEvidence: sortedUnique(review) } };
}
