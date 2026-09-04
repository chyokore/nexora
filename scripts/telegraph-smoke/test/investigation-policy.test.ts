import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateInvestigationPolicy } from "../src/investigation-policy.js";
import type { PlannedRequirement } from "../src/planner.js";
import type { EvidenceAssessment } from "../src/types.js";

function makeReq(intent: string, mandatory = true): PlannedRequirement {
  return {
    id: `req-${intent.toLowerCase()}`,
    intent: intent as PlannedRequirement["intent"],
    mandatory,
    minimumQuality: "USABLE",
    reasonCode: `${intent.toUpperCase()}_REQUIRED`,
    question: `Test question for ${intent}`,
    whyItMatters: "Test rationale",
    rationale: "Test rationale",
    condition: "Always",
  };
}

function makeAssessment(intent: string, quality: string, verification = "UNVERIFIED"): EvidenceAssessment {
  return {
    intent: intent as EvidenceAssessment["intent"],
    structuralValidity: "MATCH",
    coverage: "SUFFICIENT",
    verification: verification as EvidenceAssessment["verification"],
    quality: quality as EvidenceAssessment["quality"],
    reasons: [`quality:${quality.toLowerCase()}`],
    findings: [],
    providerFacts: {},
    uncertainties: [],
    contradictions: [],
    missingEvidence: [],
  };
}

describe("Investigation Policy", () => {
  it("returns SUPPORTED when all mandatory requirements are satisfied at minimum quality", () => {
    const reqs = [makeReq("URL_SCAN"), makeReq("FRAUD_DETECTION")];
    const assessments = [
      makeAssessment("URL_SCAN", "USABLE"),
      makeAssessment("FRAUD_DETECTION", "USABLE"),
    ];
    const decision = evaluateInvestigationPolicy(reqs, assessments);
    assert.equal(decision.verdict, "SUPPORTED");
    assert.equal(decision.unsatisfiedRequirements.length, 0);
    assert.equal(decision.disputedRequirements.length, 0);
  });

  it("returns SUPPORTED when evidence quality is STRONG (above minimum)", () => {
    const reqs = [makeReq("URL_SCAN")];
    const assessments = [makeAssessment("URL_SCAN", "STRONG")];
    const decision = evaluateInvestigationPolicy(reqs, assessments);
    assert.equal(decision.verdict, "SUPPORTED");
  });

  it("returns DISPUTED when evidence is CONTRADICTED", () => {
    const reqs = [makeReq("URL_SCAN")];
    const assessments = [{ ...makeAssessment("URL_SCAN", "USABLE"), verification: "CONTRADICTED" as const, quality: "USABLE" as const }];
    const decision = evaluateInvestigationPolicy(reqs, assessments);
    assert.equal(decision.verdict, "DISPUTED");
    assert.ok(decision.disputedRequirements.length > 0);
  });

  it("returns DISPUTED when evidence quality is CONTRADICTED", () => {
    const reqs = [makeReq("FRAUD_DETECTION")];
    const assessments = [makeAssessment("FRAUD_DETECTION", "CONTRADICTED")];
    const decision = evaluateInvestigationPolicy(reqs, assessments);
    assert.equal(decision.verdict, "DISPUTED");
  });

  it("returns INCONCLUSIVE when evidence is missing entirely", () => {
    const reqs = [makeReq("URL_SCAN")];
    const decision = evaluateInvestigationPolicy(reqs, []);
    assert.equal(decision.verdict, "INCONCLUSIVE");
    assert.ok(decision.unsatisfiedRequirements.length > 0);
  });

  it("returns INCONCLUSIVE when evidence quality is below minimum (LIMITED)", () => {
    const reqs = [makeReq("URL_SCAN")];
    const assessments = [makeAssessment("URL_SCAN", "LIMITED")];
    const decision = evaluateInvestigationPolicy(reqs, assessments);
    assert.equal(decision.verdict, "INCONCLUSIVE");
  });

  it("returns INCONCLUSIVE when evidence quality is INSUFFICIENT", () => {
    const reqs = [makeReq("URL_SCAN")];
    const assessments = [makeAssessment("URL_SCAN", "INSUFFICIENT")];
    const decision = evaluateInvestigationPolicy(reqs, assessments);
    assert.equal(decision.verdict, "INCONCLUSIVE");
  });

  it("returns INCONCLUSIVE when no requirements are defined", () => {
    const decision = evaluateInvestigationPolicy([], []);
    assert.equal(decision.verdict, "INCONCLUSIVE");
  });

  it("DISPUTED takes priority over INCONCLUSIVE", () => {
    const reqs = [makeReq("URL_SCAN"), makeReq("FRAUD_DETECTION")];
    const assessments = [
      makeAssessment("URL_SCAN", "CONTRADICTED"),
      // FRAUD_DETECTION is missing
    ];
    const decision = evaluateInvestigationPolicy(reqs, assessments);
    assert.equal(decision.verdict, "DISPUTED", "DISPUTED should take priority over INCONCLUSIVE");
  });

  it("optional requirements do not make verdict INCONCLUSIVE", () => {
    const reqs = [makeReq("URL_SCAN", false)]; // optional
    const decision = evaluateInvestigationPolicy(reqs, []); // no evidence
    assert.equal(decision.verdict, "SUPPORTED", "optional missing evidence should not make it INCONCLUSIVE");
  });

  it("includes reason codes in the output", () => {
    const reqs = [makeReq("URL_SCAN")];
    const assessments = [makeAssessment("URL_SCAN", "USABLE")];
    const decision = evaluateInvestigationPolicy(reqs, assessments);
    assert.ok(decision.reasons.some((r) => r.startsWith("satisfied:")));
    assert.ok(decision.reasons.some((r) => r.includes("verdict:")));
  });

  it("returns sorted unique satisfied requirements", () => {
    const reqs = [makeReq("URL_SCAN"), makeReq("FRAUD_DETECTION")];
    const assessments = [
      makeAssessment("URL_SCAN", "STRONG"),
      makeAssessment("FRAUD_DETECTION", "USABLE"),
    ];
    const decision = evaluateInvestigationPolicy(reqs, assessments);
    const sorted = [...decision.satisfiedRequirements].sort();
    assert.deepEqual(decision.satisfiedRequirements, sorted);
  });
});
