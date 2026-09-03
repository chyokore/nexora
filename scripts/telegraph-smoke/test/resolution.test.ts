import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { deriveResolution } from "../src/resolution.js";
import type { ActionDecision } from "../src/action-policy.js";
import type { EvidenceAssessment } from "../src/types.js";
import type { PlannedRequirement } from "../src/planner.js";

const fraudReq: PlannedRequirement = {
  intent: "FRAUD_DETECTION",
  mandatory: true,
  minimumQuality: "USABLE",
  reasonCode: "FRAUD_REQUIRED",
  rationale: "Fraud assessment required for all supplier payment authorizations",
  condition: "FRAUD_EVIDENCE_USABLE",
};

function makeAssessment(intent: string, quality: string, contradicted = false): EvidenceAssessment {
  return {
    intent: intent as EvidenceAssessment["intent"],
    structuralValidity: "MATCH" as const,
    coverage: "SUFFICIENT" as const,
    verification: contradicted ? ("CONTRADICTED" as const) : ("UNVERIFIED" as const),
    quality: quality as EvidenceAssessment["quality"],
    reasons: ["test_reason"],
    findings: [],
    providerFacts: {},
    uncertainties: [],
    contradictions: contradicted ? ["conflict_detected"] : [],
    missingEvidence: [],
  };
}

function makeAllowDecision(): ActionDecision {
  return {
    decision: "ALLOW",
    reasons: ["all_requirements_satisfied"],
    satisfiedRequirements: ["fraud-assessment"],
    unsatisfiedRequirements: [],
    reviewEvidence: [],
    blockingEvidence: [],
  };
}

function makeReviewDecision(): ActionDecision {
  return {
    decision: "REVIEW",
    reasons: ["insufficient_evidence"],
    satisfiedRequirements: [],
    unsatisfiedRequirements: ["fraud-assessment"],
    reviewEvidence: [],
    blockingEvidence: [],
  };
}

function makeBlockDecision(): ActionDecision {
  return {
    decision: "BLOCK",
    reasons: ["blocking_evidence"],
    satisfiedRequirements: [],
    unsatisfiedRequirements: [],
    reviewEvidence: [],
    blockingEvidence: ["FRAUD_DETECTION:adverse-finding-001"],
  };
}

describe("deriveResolution", () => {
  it("ALLOW decision returns resolved:true with no conditions", () => {
    const assessment = makeAssessment("FRAUD_DETECTION", "USABLE");
    const resolution = deriveResolution(makeAllowDecision(), [fraudReq], [assessment]);
    assert.strictEqual(resolution.decision, "ALLOW");
    assert.strictEqual(resolution.resolved, true);
    assert.strictEqual(resolution.unresolvedConditions.length, 0);
  });

  it("ALLOW outcomeLabel is human-readable", () => {
    const resolution = deriveResolution(makeAllowDecision(), [fraudReq], [makeAssessment("FRAUD_DETECTION", "USABLE")]);
    assert.ok(resolution.outcomeLabel.length > 0, "outcomeLabel must be non-empty");
    assert.ok(!resolution.outcomeLabel.includes("undefined"), "outcomeLabel must not contain undefined");
  });

  it("REVIEW with no assessment produces MISSING condition", () => {
    const resolution = deriveResolution(makeReviewDecision(), [fraudReq], []);
    assert.strictEqual(resolution.decision, "REVIEW");
    assert.strictEqual(resolution.resolved, false);
    assert.ok(resolution.unresolvedConditions.length > 0, "must have at least one unresolved condition");
    const missing = resolution.unresolvedConditions.find((c) => c.reasonCode === "FRAUD_EVIDENCE_MISSING");
    assert.ok(missing, "must produce FRAUD_EVIDENCE_MISSING");
  });

  it("REVIEW with CONTRADICTED assessment produces CONTRADICTED condition", () => {
    const assessment = makeAssessment("FRAUD_DETECTION", "CONTRADICTED", true);
    const resolution = deriveResolution(makeReviewDecision(), [fraudReq], [assessment]);
    assert.strictEqual(resolution.decision, "REVIEW");
    const contradicted = resolution.unresolvedConditions.find((c) => c.reasonCode === "FRAUD_EVIDENCE_CONTRADICTED");
    assert.ok(contradicted, "must produce FRAUD_EVIDENCE_CONTRADICTED");
  });

  it("REVIEW with INSUFFICIENT assessment produces BELOW_REQUIRED_QUALITY condition", () => {
    const assessment = makeAssessment("FRAUD_DETECTION", "INSUFFICIENT");
    const resolution = deriveResolution(makeReviewDecision(), [fraudReq], [assessment]);
    assert.strictEqual(resolution.decision, "REVIEW");
    const below = resolution.unresolvedConditions.find((c) => c.reasonCode === "FRAUD_EVIDENCE_BELOW_REQUIRED_QUALITY");
    assert.ok(below, "must produce FRAUD_EVIDENCE_BELOW_REQUIRED_QUALITY");
  });

  it("BLOCK decision returns resolved:false with blocking condition", () => {
    const resolution = deriveResolution(makeBlockDecision(), [fraudReq], [makeAssessment("FRAUD_DETECTION", "STRONG")]);
    assert.strictEqual(resolution.decision, "BLOCK");
    assert.strictEqual(resolution.resolved, false);
    assert.ok(resolution.unresolvedConditions.length > 0, "must have at least one blocking condition");
    const blocking = resolution.unresolvedConditions.find((c) => c.reasonCode === "BLOCKING_ADVERSE_FRAUD_EVIDENCE");
    assert.ok(blocking, "must produce BLOCKING_ADVERSE_FRAUD_EVIDENCE");
  });

  it("all unresolved conditions have non-empty human-facing descriptions", () => {
    const resolution = deriveResolution(makeReviewDecision(), [fraudReq], []);
    for (const cond of resolution.unresolvedConditions) {
      assert.ok(cond.description.length > 0, `description must be non-empty: ${cond.reasonCode}`);
      assert.ok(cond.required.length > 0, `required must be non-empty: ${cond.reasonCode}`);
      assert.ok(!cond.description.includes("undefined"), "description must not contain undefined");
    }
  });

  it("optional requirements do not generate unresolved conditions when missing", () => {
    const optionalReq: PlannedRequirement = { ...fraudReq, intent: "URL_SCAN", mandatory: false };
    const resolution = deriveResolution(makeReviewDecision(), [fraudReq, optionalReq], []);
    const urlConditions = resolution.unresolvedConditions.filter((c) => c.reasonCode.startsWith("URL_"));
    assert.strictEqual(urlConditions.length, 0, "optional requirements must not generate unresolved conditions");
  });
});
