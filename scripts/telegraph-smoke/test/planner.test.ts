import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { planEvidenceRequirements } from "../src/planner.js";
import type { ProposedAction } from "../src/action-policy.js";

const baseAction: ProposedAction = {
  id: "test-action-001",
  type: "SUPPLIER_PAYMENT_AUTHORIZATION",
  description: "Test payment authorization",
  subject: { kind: "SUPPLIER_PAYMENT", reference: "supplier-test-001" },
  riskClass: "HIGH",
};

describe("planEvidenceRequirements", () => {
  it("always requires FRAUD_DETECTION for a supplier payment action", () => {
    const plan = planEvidenceRequirements(baseAction);
    const fraud = plan.requirements.find((r) => r.intent === "FRAUD_DETECTION");
    assert.ok(fraud, "FRAUD_DETECTION requirement must exist");
    assert.strictEqual(fraud.mandatory, true);
  });

  it("requires URL_SCAN when supplierUrl is present", () => {
    const action: ProposedAction = {
      ...baseAction,
      subject: { ...baseAction.subject, supplierUrl: "https://example.com/" },
    };
    const plan = planEvidenceRequirements(action);
    const urlScan = plan.requirements.find((r) => r.intent === "URL_SCAN");
    assert.ok(urlScan, "URL_SCAN requirement must exist when supplierUrl provided");
    assert.strictEqual(urlScan.mandatory, true);
  });

  it("does not require URL_SCAN when supplierUrl is absent", () => {
    const plan = planEvidenceRequirements(baseAction);
    const urlScan = plan.requirements.find((r) => r.intent === "URL_SCAN");
    assert.strictEqual(urlScan, undefined, "URL_SCAN requirement must not exist without supplierUrl");
  });

  it("requires ONCHAIN_TX_LOOKUP when transactionHash is present", () => {
    const action: ProposedAction = {
      ...baseAction,
      subject: { ...baseAction.subject, transactionHash: "0xabc123" },
    };
    const plan = planEvidenceRequirements(action);
    const onchain = plan.requirements.find((r) => r.intent === "ONCHAIN_TX_LOOKUP");
    assert.ok(onchain, "ONCHAIN_TX_LOOKUP requirement must exist when transactionHash provided");
    assert.strictEqual(onchain.mandatory, true);
  });

  it("does not require ONCHAIN_TX_LOOKUP when transactionHash is absent", () => {
    const plan = planEvidenceRequirements(baseAction);
    const onchain = plan.requirements.find((r) => r.intent === "ONCHAIN_TX_LOOKUP");
    assert.strictEqual(onchain, undefined, "ONCHAIN_TX_LOOKUP must not exist without transactionHash");
  });

  it("returns all three requirements when both supplierUrl and transactionHash are present", () => {
    const action: ProposedAction = {
      ...baseAction,
      subject: { ...baseAction.subject, supplierUrl: "https://example.com/", transactionHash: "0xabc" },
    };
    const plan = planEvidenceRequirements(action);
    assert.strictEqual(plan.requirements.length, 3);
    const intents = plan.requirements.map((r) => r.intent);
    assert.ok(intents.includes("FRAUD_DETECTION"));
    assert.ok(intents.includes("URL_SCAN"));
    assert.ok(intents.includes("ONCHAIN_TX_LOOKUP"));
  });

  it("preserves actionType and riskClass in the plan", () => {
    const plan = planEvidenceRequirements(baseAction);
    assert.ok(plan.actionType.length > 0, "actionType must be set");
    assert.ok(plan.riskClass.length > 0, "riskClass must be set");
  });

  it("includes deterministic userQuestion, question, and whyItMatters", () => {
    const plan = planEvidenceRequirements(baseAction);
    assert.strictEqual(plan.userQuestion, "Is there enough reliable evidence for my agent to authorize this supplier payment?");
    const fraud = plan.requirements.find((r) => r.intent === "FRAUD_DETECTION");
    assert.strictEqual(fraud?.question, "Are there credible fraud indicators associated with this supplier or payment request?");
    assert.strictEqual(fraud?.whyItMatters, "A verified fraud signal could make the requested action unsafe to authorize.");
  });

  it("requirements are sorted by intent name (deterministic order)", () => {
    const action: ProposedAction = {
      ...baseAction,
      subject: { ...baseAction.subject, supplierUrl: "https://example.com/", transactionHash: "0xabc" },
    };
    const plan1 = planEvidenceRequirements(action);
    const plan2 = planEvidenceRequirements(action);
    const intents1 = plan1.requirements.map((r) => r.intent);
    const intents2 = plan2.requirements.map((r) => r.intent);
    assert.deepStrictEqual(intents1, intents2, "requirement order must be deterministic");
    const sorted = [...intents1].sort();
    assert.deepStrictEqual(intents1, sorted, "requirements must be sorted by intent name");
  });
});

