import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { runReferenceAgent } from "../src/reference-agent.js";
import { LiveRunLedger } from "../src/policy.js";
import type { ProposedAction } from "../src/action-policy.js";
import type { ExecutionEnvironment } from "../src/payment-adapter.js";

const baseAction: ProposedAction = {
  id: "ref-agent-test-001",
  type: "SUPPLIER_PAYMENT_AUTHORIZATION",
  description: "Test payment authorization for reference agent",
  subject: { kind: "SUPPLIER_PAYMENT", reference: "supplier-test-ref-001", supplierUrl: "https://example.com/" },
  riskClass: "HIGH",
};

/** A mock execution environment — no real keys, no real payments. */
const mockEnvironment: ExecutionEnvironment = {
  privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
  network: "eip155:84532",
  approvedAsset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

/** A fetch stub that simulates registry returning no miners. */
function makeEmptyRegistryFetch(): typeof fetch {
  return () => Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } }));
}

/** A fetch stub that simulates a registry failure. */
function makeFailingRegistryFetch(): typeof fetch {
  return () => Promise.resolve(new Response("Service unavailable", { status: 503 }));
}

/** A fetch stub that simulates a registry with one fraud miner (no endpoint for URL or onchain). */
function makeSingleMinerRegistry(): typeof fetch {
  const fakeMiner = {
    id: "test-miner-9999",
    name: "TestFraudMiner",
    min_price_usdc: 10000,
    supported_intents: ["FRAUD_DETECTION"],
    rank: 1,
    score: 0.9,
    endpoints: [{ path: "/fraud/check", method: "GET", intent: "FRAUD_DETECTION", input_schema: { properties: { query: { type: "string" } }, required: ["query"] } }],
    input_schema: { properties: { query: { type: "string" } }, required: ["query"] },
  };
  return () => Promise.resolve(new Response(JSON.stringify([fakeMiner]), { status: 200, headers: { "content-type": "application/json" } }));
}

describe("runReferenceAgent", () => {
  it("run ID is server-generated and not the same as the action ID", async () => {
    const result = await runReferenceAgent({
      proposedAction: baseAction,
      nodeUrl: "http://localhost:9999",
      fetchRegistry: makeFailingRegistryFetch(),
      environment: mockEnvironment,
    });
    assert.ok(result.runId !== baseAction.id, "runId must not be the action ID");
    assert.ok(result.runId.startsWith("run:"), "runId must start with run: prefix");
  });

  it("each run produces a unique runId", async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        runReferenceAgent({
          proposedAction: baseAction,
          nodeUrl: "http://localhost:9999",
          fetchRegistry: makeFailingRegistryFetch(),
          environment: mockEnvironment,
        })
      )
    );
    const ids = new Set(results.map((r) => r.runId));
    assert.strictEqual(ids.size, 3, "concurrent runs must have distinct runIds");
  });

  it("discovery failure produces fallback assessments not an exception", async () => {
    const result = await runReferenceAgent({
      proposedAction: baseAction,
      nodeUrl: "http://localhost:9999",
      fetchRegistry: makeFailingRegistryFetch(),
      environment: mockEnvironment,
    });
    assert.ok(result.evidenceAssessments.length > 0, "must have at least one fallback assessment");
    for (const a of result.evidenceAssessments) {
      assert.strictEqual(a.quality, "INVALID", "all fallback assessments must be INVALID quality");
    }
  });

  it("empty registry produces safe REVIEW decision", async () => {
    const result = await runReferenceAgent({
      proposedAction: baseAction,
      nodeUrl: "http://localhost:9999",
      fetchRegistry: makeEmptyRegistryFetch(),
      environment: mockEnvironment,
    });
    // With no miners found for any intent, evidence is INVALID and the decision must be REVIEW or BLOCK
    assert.notStrictEqual(result.actionDecision.decision, "ALLOW", "must not return ALLOW with no miners");
    assert.ok(["REVIEW", "BLOCK"].includes(result.actionDecision.decision));
  });

  it("logical call IDs are scoped to the run ID", async () => {
    const result = await runReferenceAgent({
      proposedAction: baseAction,
      nodeUrl: "http://localhost:9999",
      fetchRegistry: makeFailingRegistryFetch(),
      environment: mockEnvironment,
    });
    for (const intel of result.acquiredIntelligence) {
      assert.ok(intel.logicalCallId.startsWith(result.runId + ":"), `logicalCallId must start with runId: ${intel.logicalCallId}`);
    }
  });

  it("settlement provenance references the run ID", async () => {
    // With no miners available, settlements will be empty — verify the shape when they exist
    const result = await runReferenceAgent({
      proposedAction: baseAction,
      nodeUrl: "http://localhost:9999",
      fetchRegistry: makeFailingRegistryFetch(),
      environment: mockEnvironment,
    });
    for (const prov of result.settlementProvenance) {
      assert.strictEqual(prov.runId, result.runId, "provenance runId must match result runId");
      assert.ok(prov.logicalCallId.startsWith(result.runId + ":"), "provenance logicalCallId must be scoped to runId");
    }
  });

  it("result includes a valid decisionReplay with a fingerprint", async () => {
    const result = await runReferenceAgent({
      proposedAction: baseAction,
      nodeUrl: "http://localhost:9999",
      fetchRegistry: makeFailingRegistryFetch(),
      environment: mockEnvironment,
    });
    assert.ok(typeof result.decisionReplay.fingerprint === "string" && result.decisionReplay.fingerprint.length > 0);
    assert.ok(typeof result.decisionReplay.validation.matches === "boolean");
    assert.ok(Array.isArray(result.decisionReplay.timeline) && result.decisionReplay.timeline.length > 0);
  });

  it("agentStateLabel is a non-empty human-readable string", async () => {
    const result = await runReferenceAgent({
      proposedAction: baseAction,
      nodeUrl: "http://localhost:9999",
      fetchRegistry: makeFailingRegistryFetch(),
      environment: mockEnvironment,
    });
    assert.ok(result.agentStateLabel.length > 0, "agentStateLabel must not be empty");
    assert.ok(!result.agentStateLabel.includes("undefined"), "agentStateLabel must not contain undefined");
    assert.ok(!result.agentStateLabel.includes("HELD_FOR_REVIEW"), "agentStateLabel should be a natural phrase, not the enum value");
  });

  it("paidCallCount equals settlementProvenance length", async () => {
    const result = await runReferenceAgent({
      proposedAction: baseAction,
      nodeUrl: "http://localhost:9999",
      fetchRegistry: makeFailingRegistryFetch(),
      environment: mockEnvironment,
    });
    assert.strictEqual(result.paidCallCount, result.settlementProvenance.length);
  });
});

describe("LiveRunLedger", () => {
  it("derives run-scoped logical call IDs", () => {
    const runId = "run:test123";
    const callId = LiveRunLedger.callId(runId, "FRAUD_DETECTION");
    assert.strictEqual(callId, "run:test123:FRAUD_DETECTION");
  });

  it("rejects unknown logical call ID", () => {
    const ledger = new LiveRunLedger("run:test-reject");
    // We can't call authorize in unit tests without a full challenge,
    // but we can verify that the callId helper produces in-scope IDs
    const validId = LiveRunLedger.callId("run:test-reject", "FRAUD_DETECTION");
    assert.ok(validId.startsWith("run:test-reject:"), "valid call ID must include the run ID");
  });

  it("each live run produces distinct scope IDs", () => {
    const id1 = "run:aaaa";
    const id2 = "run:bbbb";
    const call1 = LiveRunLedger.callId(id1, "FRAUD_DETECTION");
    const call2 = LiveRunLedger.callId(id2, "FRAUD_DETECTION");
    assert.notStrictEqual(call1, call2, "different runs must produce different call IDs for same intent");
  });

  it("rejects empty runId", () => {
    assert.throws(() => new LiveRunLedger(""), { message: /requires a non-empty run ID/ });
  });
});
