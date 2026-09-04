export type Decision = "ALLOW" | "REVIEW" | "BLOCK";
export type Quality = "STRONG" | "USABLE" | "LIMITED" | "INSUFFICIENT" | "CONTRADICTED" | "INVALID";

// ---------------------------------------------------------------------------
// Generalized decision modes
// ---------------------------------------------------------------------------

export type DecisionMode = "INVESTIGATE" | "AUTHORIZE_ACTION";
export type InvestigationVerdict = "SUPPORTED" | "DISPUTED" | "INCONCLUSIVE";

export interface DecisionSource {
  type: "TEXT" | "URL" | "ONCHAIN_REFERENCE";
  value: string;
  label?: string;
}

export interface InvestigationInput {
  mode: "INVESTIGATE";
  question: string;
  sources?: DecisionSource[];
  context?: string;
}

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

export interface SanitizedRequestSummary {
  endpoint: string;
  method: string;
  intent: string;
  minerId: string;
  minerName: string;
  parameters: Record<string, unknown>;
}

export interface MinerRequestTrace {
  minerId: string;
  minerName: string;
  rank: number;
  endpoint: string;
  method: string;
  advertisedPriceMicroUsdc: number;
  selectionExplanation: string;
  requestSummary: SanitizedRequestSummary;
}

export interface MinerResponseTrace {
  minerId: string;
  minerName: string;
  status: string;
  settledMicroUsdc: number;
  providerConfidence?: number;
  providerFacts?: Record<string, string | number | boolean | null>;
  reason?: string;
}

export interface EvidenceQuestionTrace {
  id: string;
  question: string;
  whyItMatters: string;
  intent: string;
  mandatory: boolean;
  minimumQuality: string;
  reasonCode: string;
  condition: string;
  minerRequests: MinerRequestTrace[];
  minerResponses: MinerResponseTrace[];
  requirementStatus: "SATISFIED" | "UNSATISFIED" | "BLOCKING" | "OPTIONAL";
  decisionContribution: string;
}

export interface DecisionReplay {
  replayId: string;
  decisionId: string;
  userQuestion?: string | null;
  fingerprint: string;
  validation: { status: string; recordedDecision: Decision; recomputedDecision: Decision; matches: boolean; mismatches: string[]; warnings: string[] };
  evidence: EvidenceAssessment[];
  recordedDecision: ActionDecision;
  recomputedDecision: ActionDecision;
  timeline: Array<{ order: number; type: string; title: string; summary: string }>;
  postDecisionOutcome: "NOT_RECORDED";
}

export interface EvaluationResponse {
  decisionPacket: { version: 1; decisionId: string; userQuestion?: string; proposedAction: ProposedAction; evidenceAssessments: EvidenceAssessment[]; actionDecision: ActionDecision };
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

// Live Decision types (POST /v1/agent/run)
export type AgentActionState = "AUTHORIZED" | "HELD_FOR_REVIEW" | "REJECTED";

export interface IntelligenceOutcomeSummary {
  status: "acquired" | "discovery_failed" | "no_compatible_miner" | "call_failed" | "skipped";
  intent: string;
  reason?: string;
  settledMicroUsdc?: number;
  settlementMetadata?: unknown;
  assessment?: EvidenceAssessment;
}

export interface AcquiredIntelligence {
  intent: string;
  logicalCallId: string;
  minerId: string;
  minerName: string;
  rank: number;
  endpoint: string;
  method: string;
  advertisedPriceMicroUsdc: number;
  selectionExplanation?: string;
  requestSummary?: SanitizedRequestSummary;
  outcome: IntelligenceOutcomeSummary;
}

export interface UnresolvedCondition {
  reasonCode: string;
  requiredCondition: string;
  description: string;
  required: string;
}

export interface DecisionResolution {
  decision: Decision;
  resolved: boolean;
  unresolvedConditions: UnresolvedCondition[];
  outcomeLabel: string;
}

export interface PlannedRequirement {
  id?: string;
  question?: string;
  whyItMatters?: string;
  intent: string;
  mandatory: boolean;
  minimumQuality: string;
  reasonCode: string;
  rationale: string;
  condition: string;
}

export interface EvidenceRequirementPlan {
  userQuestion?: string;
  actionType: string;
  riskClass: string;
  requirements: PlannedRequirement[];
}

export interface LiveDecisionRunResult {
  runId: string;
  timestamp: string;
  userQuestion?: string;
  proposedAction: ProposedAction;
  requirementPlan: EvidenceRequirementPlan;
  evidenceQuestions?: EvidenceQuestionTrace[];
  acquiredIntelligence: AcquiredIntelligence[];
  evidenceAssessments: EvidenceAssessment[];
  actionDecision: ActionDecision;
  resolution: DecisionResolution;
  agentState: AgentActionState;
  agentStateLabel: string;
  agentStateSupport: string;
  decisionPacket: { version: 1; decisionId: string; userQuestion?: string; proposedAction: ProposedAction; evidenceAssessments: EvidenceAssessment[]; actionDecision: ActionDecision };
  decisionReplay: DecisionReplay;
  paidCallCount: number;
  totalSettledMicroUsdc: number;
  settlementProvenance: Array<{
    runId: string;
    logicalCallId: string;
    intent: string;
    minerId: string;
    minerName: string;
    settledMicroUsdc: number;
    settlementMetadata: unknown;
  }>;
}

// ---------------------------------------------------------------------------
// Investigation run result (POST /v1/investigations/run)
// ---------------------------------------------------------------------------

export interface InvestigationDecision {
  verdict: InvestigationVerdict;
  reasons: string[];
  satisfiedRequirements: string[];
  unsatisfiedRequirements: string[];
  disputedRequirements: string[];
}

export interface InvestigationRunResult {
  runId: string;
  timestamp: string;
  mode: "INVESTIGATE";
  question: string;
  investigationPlan: {
    userQuestion: string;
    requirements: Array<{
      id?: string;
      question?: string;
      whyItMatters?: string;
      intent: string;
      mandatory: boolean;
      minimumQuality: string;
      reasonCode: string;
      condition: string;
    }>;
    unsupportedAspects: string[];
    urlTarget?: string;
    txHashTarget?: string;
  };
  evidenceQuestions: EvidenceQuestionTrace[];
  acquiredIntelligence: AcquiredIntelligence[];
  evidenceAssessments: EvidenceAssessment[];
  investigationDecision: InvestigationDecision;
  verdict: InvestigationVerdict;
  verdictLabel: string;
  verdictSupport: string;
  decisionPacket: { version: 1; decisionId: string; userQuestion?: string; proposedAction: ProposedAction; evidenceAssessments: EvidenceAssessment[]; actionDecision: ActionDecision };
  decisionReplay: DecisionReplay;
  paidCallCount: number;
  totalSettledMicroUsdc: number;
  settlementProvenance: Array<{
    runId: string;
    logicalCallId: string;
    intent: string;
    minerId: string;
    minerName: string;
    settledMicroUsdc: number;
    settlementMetadata: unknown;
  }>;
  unsupportedAspects: string[];
}
