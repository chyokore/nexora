export const PAID_INTENTS = ["FRAUD_DETECTION", "URL_SCAN", "ONCHAIN_TX_LOOKUP"] as const;
export const DISCOVERY_INTENTS = [...PAID_INTENTS, "FACT_CHECK", "NEWS_SEARCH"] as const;
export type Intent = (typeof PAID_INTENTS)[number];
export type DiscoveryIntent = (typeof DISCOVERY_INTENTS)[number];

export interface JsonSchema {
  properties?: Record<string, { type?: string | string[]; enum?: unknown[] }>;
  required?: string[];
}

export interface Endpoint {
  method: string;
  path: string;
  description?: string;
}

export interface MinerScore {
  intent_id: string;
  rank: number;
  score: number;
}

export interface Miner {
  id: string;
  name: string;
  slug?: string;
  activation_status: string;
  min_price_usdc: number;
  supported_intents: string[];
  endpoints: Endpoint[];
  input_schema: JsonSchema | null;
  output_schema: JsonSchema | null;
  scores: MinerScore[];
}

export interface Selection {
  miner: Miner;
  score: MinerScore;
  endpoint: Endpoint;
  schemaFamily: string;
}

export interface PaymentChallenge {
  scheme: string;
  network: string;
  asset: string;
  amount: string | number;
  payTo: string;
  validUntil?: string | number;
  x402Version?: number;
}

export interface CaptureRecord {
  logicalTestId: string;
  intent: Intent;
  selectedMinerId: string;
  selectedMinerName: string;
  registryRank: number;
  registryScore: number;
  requestSchemaFamily: string;
  endpoint: string;
  requestContract: string;
  httpStatusSequence: number[];
  httpNegotiationSteps: string[];
  x402Version: number;
  paymentNetwork?: string;
  paymentAsset?: string;
  authorizedAmount?: number;
  reportedCost?: number;
  telegraphResponseMetadata?: unknown;
  minerResponse?: unknown;
  durationMs?: number;
  timestamp: string;
  advertisedPrice: number;
  actualChallengeAmount?: number;
  settlementMetadata?: unknown;
  settlementOccurred: boolean;
  normalizedEvidence?: DomainEvidence;
  errors: string[];
  conformance?: Conformance;
}

export interface EvidenceBase { sourceMinerId: string; sourceMinerName: string; intent: DiscoveryIntent; validationStatus: Conformance; confidence?: number; uncertainty: string[]; unavailableFields: string[]; }
export interface FraudEvidence extends EvidenceBase { intent: "FRAUD_DETECTION"; label?: string; reason?: string; }
export interface UrlSafetyEvidence extends EvidenceBase { intent: "URL_SCAN"; queriedUrl?: string; verdict?: string; safe?: boolean; reachable?: boolean; riskScore?: number; threatIndicators?: unknown[]; sources?: unknown; scanStatus?: string | number; summary?: string; }
export interface OnchainTransactionEvidence extends EvidenceBase { intent: "ONCHAIN_TX_LOOKUP"; queriedTransactionHash?: string; chain?: string; transactionStatus?: string; blockNumber?: number; blockHash?: string; from?: string; to?: string; valueWei?: string; valueNative?: number; receiptStatus?: string; method?: string; gasUsed?: string; effectiveGasPrice?: string; tokenEvents?: unknown[]; source?: unknown; }
export interface FactCheckEvidence extends EvidenceBase { intent: "FACT_CHECK"; verdict?: string; sources?: unknown[]; }
export type DomainEvidence = FraudEvidence | UrlSafetyEvidence | OnchainTransactionEvidence | FactCheckEvidence;

export type Conformance = "MATCH" | "COMPATIBLE_WITH_ADAPTER" | "MISMATCH" | "INVALID";

export type EvidenceCoverage = "SUFFICIENT" | "PARTIAL" | "OUT_OF_COVERAGE" | "UNKNOWN";
export type EvidenceVerification = "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | "CONTRADICTED" | "NOT_APPLICABLE";
export type EvidenceQuality = "STRONG" | "USABLE" | "LIMITED" | "INSUFFICIENT" | "CONTRADICTED" | "INVALID";
export type EvidenceFactValue = string | number | boolean | null | EvidenceFactValue[] | { [key: string]: EvidenceFactValue };

export interface SanitizedRequestSummary {
  endpoint: string;
  method: string;
  intent: DiscoveryIntent;
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
  status: "acquired" | "discovery_failed" | "no_compatible_miner" | "call_failed" | "skipped";
  settledMicroUsdc: number;
  providerConfidence?: number;
  providerFacts?: Record<string, EvidenceFactValue>;
  rawVerdict?: string;
  reason?: string;
}

export interface EvidenceQuestionTrace {
  id: string;
  question: string;
  whyItMatters: string;
  intent: DiscoveryIntent;
  mandatory: boolean;
  minimumQuality: "USABLE" | "STRONG";
  reasonCode: string;
  condition: string;
  minerRequests: MinerRequestTrace[];
  minerResponses: MinerResponseTrace[];
  requirementStatus: "SATISFIED" | "UNSATISFIED" | "BLOCKING" | "OPTIONAL";
  decisionContribution: string;
}

export interface EvidenceAssessment {
  intent: DiscoveryIntent;
  structuralValidity: Conformance;
  coverage: EvidenceCoverage;
  verification: EvidenceVerification;
  providerConfidence?: number;
  quality: EvidenceQuality;
  reasons: string[];
  findings: string[];
  providerFacts?: Record<string, EvidenceFactValue>;
  uncertainties: string[];
  contradictions: string[];
  missingEvidence: string[];
}

