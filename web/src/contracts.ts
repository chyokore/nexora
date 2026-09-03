export type Decision = "ALLOW" | "REVIEW" | "BLOCK";
export type Quality = "STRONG" | "USABLE" | "LIMITED" | "INSUFFICIENT" | "CONTRADICTED" | "INVALID";

export interface ProposedAction {
  id: string;
  type: "SUPPLIER_PAYMENT_AUTHORIZATION";
  description: string;
  subject: { kind: "SUPPLIER_PAYMENT"; reference: string; supplierUrl?: string; transactionHash?: string };
  riskClass: "HIGH";
}

export interface EvidenceAssessment {
  intent: "FRAUD_DETECTION" | "URL_SCAN" | "ONCHAIN_TX_LOOKUP" | "FACT_CHECK" | "NEWS_SEARCH";
  structuralValidity: "MATCH" | "COMPATIBLE_WITH_ADAPTER" | "MISMATCH" | "INVALID";
  coverage: "SUFFICIENT" | "PARTIAL" | "OUT_OF_COVERAGE" | "UNKNOWN";
  verification: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | "CONTRADICTED" | "NOT_APPLICABLE";
  providerConfidence?: number;
  quality: Quality;
  reasons: string[];
  findings: string[];
  providerFacts?: Record<string, string | number | boolean | null>;
  uncertainties: string[];
  contradictions: string[];
  missingEvidence: string[];
}

export interface ActionDecision {
  decision: Decision;
  reasons: string[];
  satisfiedRequirements: string[];
  unsatisfiedRequirements: string[];
  blockingEvidence: string[];
  reviewEvidence: string[];
}

export interface DecisionReplay {
  replayId: string;
  decisionId: string;
  fingerprint: string;
  validation: { status: string; recordedDecision: Decision; recomputedDecision: Decision; matches: boolean; mismatches: string[]; warnings: string[] };
  evidence: EvidenceAssessment[];
  recordedDecision: ActionDecision;
  recomputedDecision: ActionDecision;
  timeline: Array<{ order: number; type: string; title: string; summary: string }>;
  postDecisionOutcome: "NOT_RECORDED";
}

export interface EvaluationResponse {
  decisionPacket: { version: 1; decisionId: string; proposedAction: ProposedAction; evidenceAssessments: EvidenceAssessment[]; actionDecision: ActionDecision };
  decisionReplay: DecisionReplay;
}

export interface DiscoveryWinner {
  id: string;
  name: string;
  rank: number;
  score: number;
  method: string;
  endpoint: string;
  schemaFamily: string;
  advertisedPriceMicroUsdc: number;
}

export interface DiscoveryIntentSummary {
  eligibleCount: number;
  winner: DiscoveryWinner | null;
}

export interface DiscoveryResponse {
  status: string;
  service: string;
  discoveryType: string;
  timestamp: string;
  totalRegistrations: number;
  discovery: Record<string, DiscoveryIntentSummary>;
}
