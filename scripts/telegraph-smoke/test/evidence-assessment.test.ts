import assert from "node:assert/strict";
import test from "node:test";
import { assessEvidence, assessNormalizedEvidence, serializeEvidenceAssessment } from "../src/evidence-assessment.js";
import type { FraudEvidence } from "../src/types.js";
import { fraudOutOfCoverageFixture, onchainContradictedFixture, urlSupportedFixture } from "./fixtures/sanitized-live-evidence.js";

const fraudAssessment = () => assessNormalizedEvidence(fraudOutOfCoverageFixture, { verification: "UNVERIFIED" });
const urlAssessment = () => assessNormalizedEvidence(urlSupportedFixture, { verification: "UNVERIFIED" });
const contradiction = "provider_not_found_conflicts_with_independent_rpc_existence";
const onchainAssessment = () => assessNormalizedEvidence(onchainContradictedFixture, { verification: "CONTRADICTED", contradictions: [contradiction] });

test("captured fraud abstention produces insufficient evidence", () => { const result = fraudAssessment(); assert.equal(result.coverage, "OUT_OF_COVERAGE"); assert.equal(result.verification, "NOT_APPLICABLE"); assert.equal(result.quality, "INSUFFICIENT"); });
test("fraud confidence zero is not interpreted as safe", () => { const result = fraudAssessment(); assert.equal(result.providerConfidence, 0); assert.equal(result.quality, "INSUFFICIENT"); assert.equal(JSON.stringify(result).includes("safe"), false); });
test("captured URL evidence is usable with bounded uncertainty", () => { const result = urlAssessment(); assert.equal(result.quality, "USABLE"); assert.deepEqual(result.uncertainties, ["finite_provider_coverage", "no_future_safety_guarantee", "point_in_time_scan"]); });
test("empty URL threat feeds do not assert universal safety", () => { const result = urlAssessment(); assert.ok(result.uncertainties.includes("finite_provider_coverage")); assert.ok(result.uncertainties.includes("no_future_safety_guarantee")); });
test("independently conflicting onchain existence is contradicted", () => { const result = onchainAssessment(); assert.equal(result.verification, "CONTRADICTED"); assert.equal(result.quality, "CONTRADICTED"); });
test("confidence one cannot override contradiction precedence", () => { const result = onchainAssessment(); assert.equal(result.providerConfidence, 1); assert.notEqual(result.quality, "STRONG"); assert.notEqual(result.quality, "USABLE"); });
test("contradiction details force contradiction precedence", () => { const result = assessEvidence({ evidence: urlSupportedFixture, coverage: "SUFFICIENT", verification: "UNVERIFIED", contradictions: ["independent_fact_differs"] }); assert.equal(result.verification, "CONTRADICTED"); assert.equal(result.quality, "CONTRADICTED"); });
test("structurally invalid evidence is invalid and unusable", () => { const evidence = { ...fraudOutOfCoverageFixture, validationStatus: "INVALID" as const }; const result = assessEvidence({ evidence, coverage: "SUFFICIENT", verification: "VERIFIED" }); assert.equal(result.quality, "INVALID"); });
test("structural mismatch without adapter is invalid and unusable", () => { const evidence = { ...urlSupportedFixture, validationStatus: "MISMATCH" as const }; const result = assessEvidence({ evidence, coverage: "SUFFICIENT", verification: "VERIFIED" }); assert.equal(result.quality, "INVALID"); });
test("missing confidence remains absent", () => { const { confidence: _confidence, ...evidence } = fraudOutOfCoverageFixture; const result = assessNormalizedEvidence(evidence, { verification: "NOT_APPLICABLE" }); assert.equal("providerConfidence" in result, false); });
test("unverified evidence does not become contradicted", () => { const result = urlAssessment(); assert.equal(result.verification, "UNVERIFIED"); assert.notEqual(result.quality, "CONTRADICTED"); });
test("provider confidence is preserved exactly", () => assert.equal(urlAssessment().providerConfidence, 0.93));
test("contradiction details are preserved", () => assert.deepEqual(onchainAssessment().contradictions, [contradiction]));
test("missing evidence is preserved", () => assert.deepEqual(onchainAssessment().missingEvidence, ["blockNumber", "from", "receiptStatus", "to", "valueWei"]));
test("assessment serialization is deterministic", () => { const first = serializeEvidenceAssessment(onchainAssessment()); const second = serializeEvidenceAssessment(onchainAssessment()); assert.equal(first, second); assert.deepEqual(JSON.parse(first), onchainAssessment()); });
test("repeated identical input is byte-equivalent and immutable", () => { const input: FraudEvidence = structuredClone(fraudOutOfCoverageFixture); const before = JSON.stringify(input); assert.equal(serializeEvidenceAssessment(assessNormalizedEvidence(input, { verification: "UNVERIFIED" })), serializeEvidenceAssessment(assessNormalizedEvidence(input, { verification: "UNVERIFIED" }))); assert.equal(JSON.stringify(input), before); });
