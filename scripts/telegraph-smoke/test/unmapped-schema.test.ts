import assert from "node:assert/strict";
import { test } from "node:test";
import { extractUnmappedSchema, normalizeEvidence } from "../src/normalization.js";
import { assessNormalizedEvidence } from "../src/evidence-assessment.js";
import { replayDecisionPacket } from "../src/decision-replay.js";
import { createDecisionPacket } from "../src/decision-packet.js";
import type { Selection } from "../src/types.js";

const mockSelection: Selection = {
  miner: {
    id: "302",
    name: "ChainSight",
    activation_status: "active",
    min_price_usdc: 10000,
    supported_intents: ["ONCHAIN_TX_LOOKUP"],
    endpoints: [{ method: "GET", path: "/tx", description: "ONCHAIN_TX_LOOKUP. Test endpoint." }],
    input_schema: { properties: { hash: { type: "string" } } },
    output_schema: { properties: { status: { type: "string" } } },
    scores: [{ intent_id: "ONCHAIN_TX_LOOKUP", rank: 1, score: 0.9 }],
  },
  score: { intent_id: "ONCHAIN_TX_LOOKUP", rank: 1, score: 0.9 },
  endpoint: { path: "/tx", method: "GET" },
  schemaFamily: "transaction-identifier",
};

test("extractUnmappedSchema retains key names and value types, but NOT raw values", () => {
  const rawResponse = {
    status: "confirmed", // mapped key for ONCHAIN_TX_LOOKUP
    block: 46307152,      // unmapped key
    gas_used: "21000",   // mapped key
    custom_flag: true,   // unmapped key
    raw_payload_data: "SENSITIVE_SECRET_123", // unmapped key
  };

  const schema = extractUnmappedSchema("ONCHAIN_TX_LOOKUP", rawResponse);
  const paths = schema.map((item) => item.path);
  const stringified = JSON.stringify(schema);

  assert.ok(paths.includes("block"), "unmapped 'block' key should be retained");
  assert.ok(paths.includes("custom_flag"), "unmapped 'custom_flag' key should be retained");
  assert.ok(paths.includes("raw_payload_data"), "unmapped 'raw_payload_data' key path should be retained");
  assert.strictEqual(schema.find((item) => item.path === "block")?.type, "number");
  assert.strictEqual(schema.find((item) => item.path === "custom_flag")?.type, "boolean");

  // Verify raw string values are NOT in the schema
  assert.ok(!stringified.includes("SENSITIVE_SECRET_123"), "Raw string value MUST NOT be retained in unmappedSchema");
  assert.ok(!stringified.includes("46307152"), "Raw number value MUST NOT be retained in unmappedSchema");
});

test("sensitive key names are excluded from unmappedSchema", () => {
  const sensitiveResponse = {
    authorization: "Bearer secret-token",
    signature: "0x123456",
    payment_signature: "0xabcdef",
    privateKey: "0x9999",
    secret: "shh",
    safe_unmapped_field: "hello",
  };

  const schema = extractUnmappedSchema("ONCHAIN_TX_LOOKUP", sensitiveResponse);
  const paths = schema.map((item) => item.path);

  assert.ok(!paths.includes("authorization"), "authorization key must be filtered");
  assert.ok(!paths.includes("signature"), "signature key must be filtered");
  assert.ok(!paths.includes("payment_signature"), "payment_signature key must be filtered");
  assert.ok(!paths.includes("privateKey"), "privateKey key must be filtered");
  assert.ok(!paths.includes("secret"), "secret key must be filtered");
  assert.ok(paths.includes("safe_unmapped_field"), "safe_unmapped_field should be included");
});

test("nested structures and arrays are safely summarized and bounded", () => {
  const nestedResponse = {
    meta: {
      inner_count: 5,
      inner_object: { deep: "nested" },
    },
    items: [1, 2, 3, 4],
  };

  const schema = extractUnmappedSchema("ONCHAIN_TX_LOOKUP", nestedResponse);
  const paths = schema.map((item) => item.path);

  assert.ok(paths.includes("meta"), "meta object path should be retained");
  assert.strictEqual(schema.find((item) => item.path === "meta")?.type, "object");
  assert.ok(paths.includes("meta.inner_count"), "meta.inner_count nested path should be retained");
  assert.strictEqual(schema.find((item) => item.path === "meta.inner_count")?.type, "number");
  assert.ok(paths.includes("items"), "items array path should be retained");
  assert.strictEqual(schema.find((item) => item.path === "items")?.type, "array[4]");

  // Max entry bounding check (should not exceed 25 entries)
  assert.ok(schema.length <= 25, "Unmapped schema entries must be bounded by 25");
});

test("normalizeEvidence and assessNormalizedEvidence preserve unmappedSchema in providerFacts without altering quality", () => {
  const rawResponse = {
    status: "confirmed",
    tx_hash: "0x123",
    chain: "base-sepolia",
    unmapped_provider_metric: 99.5,
  };

  const norm = normalizeEvidence("ONCHAIN_TX_LOOKUP", mockSelection, rawResponse, "MATCH");
  assert.ok(norm.unmappedSchema, "norm.unmappedSchema should exist");

  const assessment = assessNormalizedEvidence(norm, { verification: "UNVERIFIED" });
  assert.strictEqual(assessment.quality, "USABLE", "Quality verdict must remain USABLE");
  assert.strictEqual(assessment.coverage, "SUFFICIENT", "Coverage must remain SUFFICIENT");
  assert.ok(assessment.providerFacts, "providerFacts should exist");
  assert.ok("_unmappedSchema" in assessment.providerFacts, "_unmappedSchema should be in providerFacts");

  // Replay integrity check
  const proposedAction = {
    id: "action-test-01",
    type: "SUPPLIER_PAYMENT_AUTHORIZATION" as const,
    description: "Authorize payment",
    subject: { kind: "SUPPLIER_PAYMENT" as const, reference: "ref-1", transactionHash: "0x123" },
    riskClass: "HIGH" as const,
  };

  const packet = createDecisionPacket("decision-unmapped-test", proposedAction, [assessment]);
  const replay = replayDecisionPacket(packet);
  assert.strictEqual(replay.validation.status, "VERIFIED", "Decision Replay validation status must be VERIFIED");
});
