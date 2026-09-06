import assert from "node:assert/strict";
import { test } from "node:test";
import {
  saveReceipt,
  getReceipt,
  validateReceiptId,
  isReceiptStorageConfigured,
  clearInMemoryReceipts,
} from "../src/receipt-store.js";
import { createDecisionPacket, type DecisionPacket } from "../src/decision-packet.js";
import { replayDecisionPacket } from "../src/decision-replay.js";
import type { EvidenceAssessment } from "../src/types.js";
import type { ProposedAction } from "../src/action-policy.js";

const mockAction: ProposedAction = {
  id: "action-receipt-test",
  type: "SUPPLIER_PAYMENT_AUTHORIZATION",
  description: "Test supplier payment",
  subject: {
    kind: "SUPPLIER_PAYMENT",
    reference: "inv-999",
    transactionHash: "0xcd9a4af2f822034bf8b8437815c17d3f2ae56bbee8d7444b3c12093525da1882",
  },
  riskClass: "HIGH",
};

const mockAssessment: EvidenceAssessment = {
  intent: "ONCHAIN_TX_LOOKUP",
  structuralValidity: "MATCH",
  coverage: "SUFFICIENT",
  verification: "UNVERIFIED",
  quality: "USABLE",
  reasons: ["relevant_provider_evidence_not_independently_verified"],
  findings: ["TX_CONFIRMED"],
  providerFacts: {
    transactionStatus: "confirmed",
    queriedTransactionHash: "0xcd9a4af2f822034bf8b8437815c17d3f2ae56bbee8d7444b3c12093525da1882",
    chain: "base-sepolia",
  },
  uncertainties: [],
  contradictions: [],
  missingEvidence: [],
};

test("sanitized receipt persists successfully and can be retrieved", async () => {
  clearInMemoryReceipts();
  const packet = createDecisionPacket("decision-receipt-01", mockAction, [mockAssessment], "Is this payment authorized?");

  const saveRes = await saveReceipt(packet, {});
  assert.ok(saveRes, "saveReceipt should return a result");
  assert.strictEqual(saveRes.created, true, "First save should set created: true");

  const retrieved = await getReceipt(saveRes.receiptId, {});
  assert.ok(retrieved, "getReceipt should return persisted envelope");
  assert.strictEqual(retrieved!.receiptId, saveRes!.receiptId);
  assert.strictEqual(retrieved!.version, 1);
  assert.ok(retrieved!.packet, "Retrieved receipt must contain decisionPacket");
});

test("identical receipt cannot overwrite immutable stored value (NX semantics)", async () => {
  clearInMemoryReceipts();
  const packet = createDecisionPacket("decision-receipt-immutable", mockAction, [mockAssessment]);

  const firstSave = await saveReceipt(packet, {});
  assert.ok(firstSave);
  assert.strictEqual(firstSave.created, true);

  const secondSave = await saveReceipt(packet, {});
  assert.ok(secondSave);
  assert.strictEqual(secondSave.created, false, "Second save of identical immutable receipt must return created: false");
});

test("missing receipt returns safe not-found (null)", async () => {
  clearInMemoryReceipts();
  const res = await getReceipt("0000000000000000000000000000000000000000000000000000000000000000", {});
  assert.strictEqual(res, null, "Missing receipt ID must return null");
});

test("invalid receipt ID is rejected", async () => {
  assert.strictEqual(validateReceiptId("../invalid/path"), false);
  assert.strictEqual(validateReceiptId("short"), false);
  assert.strictEqual(validateReceiptId("<script>alert(1)</script>"), false);

  const res = await getReceipt("../invalid/path", {});
  assert.strictEqual(res, null, "Invalid receipt ID must return null");
});

test("missing storage env does not break decision execution or throw", () => {
  assert.strictEqual(isReceiptStorageConfigured({}), false);
});

test("sensitive fields are redacted while transaction hashes are preserved", async () => {
  clearInMemoryReceipts();
  const sensitiveAssessment: EvidenceAssessment = {
    ...mockAssessment,
    providerFacts: {
      ...mockAssessment.providerFacts,
      private_key: "0x1234567890123456789012345678901234567890123456789012345678901234",
      payment_signature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      queriedTransactionHash: "0xcd9a4af2f822034bf8b8437815c17d3f2ae56bbee8d7444b3c12093525da1882",
    },
  };

  const packet = createDecisionPacket("decision-sensitive-test", mockAction, [sensitiveAssessment]);
  const saveRes = await saveReceipt(packet, {});
  assert.ok(saveRes);

  const retrieved = await getReceipt(saveRes!.receiptId, {});
  assert.ok(retrieved);

  const firstAssessment = retrieved!.packet.evidenceAssessments[0];
  assert.ok(firstAssessment);
  const facts = firstAssessment.providerFacts as Record<string, unknown>;
  assert.strictEqual(facts.private_key, "[REDACTED]", "private_key must be redacted");
  assert.strictEqual(facts.payment_signature, "[REDACTED]", "payment_signature must be redacted");
  assert.strictEqual(
    facts.queriedTransactionHash,
    "0xcd9a4af2f822034bf8b8437815c17d3f2ae56bbee8d7444b3c12093525da1882",
    "Blockchain transaction hash MUST be preserved"
  );
});

test("persisted receipt replays to VERIFIED MATCH", async () => {
  clearInMemoryReceipts();
  const packet = createDecisionPacket("decision-replay-test", mockAction, [mockAssessment]);
  const saveRes = await saveReceipt(packet, {});
  assert.ok(saveRes);

  const retrieved = await getReceipt(saveRes!.receiptId, {});
  assert.ok(retrieved);

  const replay = replayDecisionPacket(retrieved!.packet);
  assert.strictEqual(replay.validation.status, "VERIFIED");
  assert.strictEqual(replay.validation.matches, true);
});

test("tampered stored packet produces VERIFICATION FAILED or validation failure", async () => {
  clearInMemoryReceipts();
  const packet = createDecisionPacket("decision-tamper-test", mockAction, [mockAssessment]);
  const saveRes = await saveReceipt(packet, {});
  assert.ok(saveRes);

  const retrieved = await getReceipt(saveRes!.receiptId, {});
  assert.ok(retrieved);

  // Tamper with recorded action decision
  const tamperedPacket: DecisionPacket = {
    ...retrieved!.packet,
    actionDecision: {
      ...retrieved!.packet.actionDecision,
      decision: "ALLOW", // Original was REVIEW
    },
  };

  const replay = replayDecisionPacket(tamperedPacket);
  assert.strictEqual(replay.validation.matches, false, "Tampered packet must fail verification match");
});

test("oversized receipt is refused", async () => {
  const hugeAssessment: EvidenceAssessment = {
    ...mockAssessment,
    reasons: Array.from({ length: 2000 }, (_, i) => `very_long_unnecessary_reason_entry_${i}_padding_bytes`),
  };

  const hugePacket = createDecisionPacket("decision-huge-test", mockAction, [hugeAssessment]);
  const saveRes = await saveReceipt(hugePacket, {});
  assert.strictEqual(saveRes, null, "Oversized receipt (>64KB) must be refused");
});
