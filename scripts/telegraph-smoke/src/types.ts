export const INTENTS = ["FRAUD_DETECTION", "URL_SCAN", "ONCHAIN_TX_LOOKUP"] as const;
export type Intent = (typeof INTENTS)[number];

export interface JsonSchema {
  properties?: Record<string, { type?: string | string[] }>;
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
  httpStatus?: number;
  telegraphResponseMetadata?: unknown;
  minerResponse?: unknown;
  durationMs?: number;
  timestamp: string;
  advertisedPrice: number;
  actualChallengeAmount?: number;
  settlementMetadata?: unknown;
  conformance?: Conformance;
}

export type Conformance = "MATCH" | "COMPATIBLE_WITH_ADAPTER" | "MISMATCH" | "INVALID";
