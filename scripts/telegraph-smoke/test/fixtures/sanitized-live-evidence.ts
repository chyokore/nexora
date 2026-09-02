import type { FraudEvidence, OnchainTransactionEvidence, UrlSafetyEvidence } from "../../src/types.js";

// Captured/sanitized live-response fixtures used for deterministic tests.
// These contain normalized evidence only; no payment authorization or secret material.
export const fraudOutOfCoverageFixture: FraudEvidence = {
  sourceMinerId: "sanitized-provider",
  sourceMinerName: "Sanitized provider",
  intent: "FRAUD_DETECTION",
  validationStatus: "MATCH",
  confidence: 0,
  label: "out_of_coverage",
  reason: "The supplied scenario was outside supported coverage.",
  uncertainty: ["coverage_incomplete", "data_source_unavailable", "insufficient_data"],
  unavailableFields: [],
};

export const urlSupportedFixture: UrlSafetyEvidence = {
  sourceMinerId: "sanitized-provider",
  sourceMinerName: "Sanitized provider",
  intent: "URL_SCAN",
  validationStatus: "MATCH",
  confidence: 0.93,
  queriedUrl: "https://example.com/",
  verdict: "low",
  safe: true,
  reachable: true,
  riskScore: 0.1,
  threatIndicators: [],
  sources: ["URLhaus", "OpenPhish"],
  scanStatus: 200,
  summary: "No listings were returned by the checked feeds.",
  uncertainty: [],
  unavailableFields: [],
};

export const onchainContradictedFixture: OnchainTransactionEvidence = {
  sourceMinerId: "sanitized-provider",
  sourceMinerName: "Sanitized provider",
  intent: "ONCHAIN_TX_LOOKUP",
  validationStatus: "MATCH",
  confidence: 1,
  queriedTransactionHash: "0xsanitized-transaction-reference",
  chain: "base",
  transactionStatus: "not_found",
  uncertainty: ["transaction_not_found_by_miner"],
  unavailableFields: ["blockNumber", "from", "to", "valueWei", "receiptStatus"],
};
