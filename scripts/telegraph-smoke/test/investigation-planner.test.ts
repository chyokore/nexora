import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planInvestigationRequirements } from "../src/investigation-planner.js";

describe("Investigation Planner", () => {
  it("routes a URL source to URL_SCAN", () => {
    const plan = planInvestigationRequirements({
      mode: "INVESTIGATE",
      question: "Is this link safe?",
      sources: [{ type: "URL", value: "https://example.com/supplier" }],
    });
    assert.ok(plan.requirements.some((r) => r.intent === "URL_SCAN"), "should plan URL_SCAN");
    assert.equal(plan.urlTarget, "https://example.com/supplier");
    assert.equal(plan.unsupportedAspects.length, 0);
  });

  it("routes an onchain reference to ONCHAIN_TX_LOOKUP", () => {
    const plan = planInvestigationRequirements({
      mode: "INVESTIGATE",
      question: "Does this transaction exist?",
      sources: [{ type: "ONCHAIN_REFERENCE", value: "0xabc123" }],
    });
    assert.ok(plan.requirements.some((r) => r.intent === "ONCHAIN_TX_LOOKUP"), "should plan ONCHAIN_TX_LOOKUP");
    assert.equal(plan.txHashTarget, "0xabc123");
    assert.equal(plan.unsupportedAspects.length, 0);
  });

  it("routes fraud keywords to FRAUD_DETECTION", () => {
    const plan = planInvestigationRequirements({
      mode: "INVESTIGATE",
      question: "Is this a phishing site?",
    });
    assert.ok(plan.requirements.some((r) => r.intent === "FRAUD_DETECTION"), "should plan FRAUD_DETECTION");
    assert.equal(plan.unsupportedAspects.length, 0);
  });

  it("routes URL + fraud keywords to both URL_SCAN and FRAUD_DETECTION", () => {
    const plan = planInvestigationRequirements({
      mode: "INVESTIGATE",
      question: "Is this URL a scam?",
      sources: [{ type: "URL", value: "https://suspicious-site.example" }],
    });
    assert.ok(plan.requirements.some((r) => r.intent === "URL_SCAN"), "should plan URL_SCAN");
    assert.ok(plan.requirements.some((r) => r.intent === "FRAUD_DETECTION"), "should plan FRAUD_DETECTION");
    assert.equal(plan.unsupportedAspects.length, 0);
  });

  it("returns empty requirements and unsupportedAspects for unrecognizable input", () => {
    const plan = planInvestigationRequirements({
      mode: "INVESTIGATE",
      question: "What is the weather in Lagos?",
    });
    assert.equal(plan.requirements.length, 0);
    assert.ok(plan.unsupportedAspects.length > 0, "should report unsupported aspects");
  });

  it("is deterministic — same input always produces same plan", () => {
    const input = {
      mode: "INVESTIGATE" as const,
      question: "Is this suspicious URL fraudulent?",
      sources: [{ type: "URL" as const, value: "https://example.com/" }],
    };
    const plan1 = planInvestigationRequirements(input);
    const plan2 = planInvestigationRequirements(input);
    assert.deepEqual(
      plan1.requirements.map((r) => r.intent),
      plan2.requirements.map((r) => r.intent)
    );
    assert.equal(plan1.urlTarget, plan2.urlTarget);
    assert.equal(plan1.unsupportedAspects.length, plan2.unsupportedAspects.length);
  });

  it("sorts requirements deterministically", () => {
    const plan = planInvestigationRequirements({
      mode: "INVESTIGATE",
      question: "Is this a fraudulent URL with an onchain transaction?",
      sources: [
        { type: "URL", value: "https://example.com/" },
        { type: "ONCHAIN_REFERENCE", value: "0xabc" },
      ],
    });
    const intents = plan.requirements.map((r) => r.intent);
    const sorted = [...intents].sort();
    assert.deepEqual(intents, sorted, "requirements should be sorted by intent");
  });

  it("marks all requirements as mandatory", () => {
    const plan = planInvestigationRequirements({
      mode: "INVESTIGATE",
      question: "fraud risk",
      sources: [{ type: "URL", value: "https://x.com" }],
    });
    for (const req of plan.requirements) {
      assert.equal(req.mandatory, true, `${req.intent} should be mandatory`);
    }
  });

  it("includes a meaningful question string in each requirement", () => {
    const plan = planInvestigationRequirements({
      mode: "INVESTIGATE",
      question: "Is this URL safe?",
      sources: [{ type: "URL", value: "https://example.com" }],
    });
    for (const req of plan.requirements) {
      assert.ok(typeof req.question === "string" && req.question.length > 0, `${req.intent} should have a question`);
      assert.ok(typeof req.whyItMatters === "string" && req.whyItMatters.length > 0, `${req.intent} should have whyItMatters`);
    }
  });
});
