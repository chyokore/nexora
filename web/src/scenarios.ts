import type { EvidenceAssessment } from "./contracts";

export type ScenarioId = "supported" | "coverage-gap" | "contradicted" | "adverse";
export interface Scenario { id: ScenarioId; name: string; description: string; provenance: string; transactionHash?: string; evidence: EvidenceAssessment[] }

const urlClear: EvidenceAssessment = {
  intent: "URL_SCAN", structuralValidity: "MATCH", coverage: "SUFFICIENT", verification: "VERIFIED", providerConfidence: 0.94, quality: "USABLE",
  reasons: ["Sanitized URL boundary fixture returned usable safety evidence"], findings: ["URL_CHECKS_CLEAR"], providerFacts: { verdict: "safe", reachable: true },
  uncertainties: ["No live request is performed by this demo"], contradictions: [], missingEvidence: [],
};

const fraudClear: EvidenceAssessment = {
  intent: "FRAUD_DETECTION", structuralValidity: "MATCH", coverage: "SUFFICIENT", verification: "PARTIALLY_VERIFIED", providerConfidence: 0.91, quality: "STRONG",
  reasons: ["Sanitized fraud boundary fixture supports the requested check"], findings: ["FRAUD_SCREEN_CLEAR"], providerFacts: { label: "screen_clear" },
  uncertainties: ["Provider confidence is not Nexora evidence quality"], contradictions: [], missingEvidence: [],
};

export const scenarios: Scenario[] = [
  { id: "supported", name: "SUPPORTED", description: "Required evidence conditions are supported", provenance: "SANITIZED BOUNDARY FIXTURE", evidence: [fraudClear, urlClear] },
  { id: "coverage-gap", name: "FRAUD COVERAGE GAP", description: "The provider could not cover the fraud question", provenance: "LIVE-DERIVED · SANITIZED", evidence: [{
    intent: "FRAUD_DETECTION", structuralValidity: "MATCH", coverage: "OUT_OF_COVERAGE", verification: "UNVERIFIED", providerConfidence: 0, quality: "INSUFFICIENT",
    reasons: ["The provider response did not cover the requested fraud assessment"], findings: [], providerFacts: { label: "out_of_coverage" }, uncertainties: ["Fraud status remains unknown"], contradictions: [], missingEvidence: ["A covered fraud assessment"],
  }, urlClear] },
  { id: "contradicted", name: "CONTRADICTED ONCHAIN", description: "Independent evidence conflicts with a provider result", provenance: "LIVE-DERIVED · SANITIZED", transactionHash: "sanitized-transaction-reference", evidence: [fraudClear, urlClear, {
    intent: "ONCHAIN_TX_LOOKUP", structuralValidity: "MATCH", coverage: "SUFFICIENT", verification: "CONTRADICTED", providerConfidence: 1, quality: "CONTRADICTED",
    reasons: ["The claimed transaction conflicts with the sanitized lookup boundary"], findings: [], providerFacts: { transactionStatus: "not_found", chain: "base", queriedTransactionHash: "sanitized-transaction-reference" }, uncertainties: [], contradictions: ["Claimed transaction was not found"], missingEvidence: ["Verified transaction context"],
  }] },
  { id: "adverse", name: "VERIFIED ADVERSE", description: "An explicit verified policy condition is present", provenance: "SYNTHETIC POLICY TEST", evidence: [{
    intent: "FRAUD_DETECTION", structuralValidity: "MATCH", coverage: "SUFFICIENT", verification: "VERIFIED", providerConfidence: 0.99, quality: "STRONG",
    reasons: ["Synthetic policy fixture contains an explicit verified adverse finding"], findings: ["FRAUD_CONFIRMED"], providerFacts: { label: "confirmed_risk" }, uncertainties: [], contradictions: [], missingEvidence: [],
  }, urlClear] },
];

export function scenarioById(id: ScenarioId): Scenario { return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0]; }
