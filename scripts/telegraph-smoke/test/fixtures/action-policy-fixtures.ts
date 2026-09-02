import { assessEvidence, assessNormalizedEvidence } from "../../src/evidence-assessment.js";
import type { ProposedAction } from "../../src/action-policy.js";
import type { EvidenceAssessment, FraudEvidence } from "../../src/types.js";
import { fraudOutOfCoverageFixture, onchainContradictedFixture, urlSupportedFixture } from "./sanitized-live-evidence.js";

export const proposedSupplierPayment: ProposedAction = {
  id: "supplier-payment-proposal-001",
  type: "SUPPLIER_PAYMENT_AUTHORIZATION",
  description: "Authorize a proposed supplier payment after required evidence review.",
  subject: { kind: "SUPPLIER_PAYMENT", reference: "supplier-reference-001", supplierUrl: "https://example.com/" },
  riskClass: "HIGH",
};

const { confidence: _omittedConfidence, ...fraudWithoutConfidence } = fraudOutOfCoverageFixture;
const supportedFraud: FraudEvidence = { ...fraudWithoutConfidence, label: "screen_clear", reason: "The bounded fraud screen supplied a clear finding.", uncertainty: ["bounded_provider_coverage"] };

export const strongFraudWithoutConfidence: EvidenceAssessment = assessEvidence({ evidence: supportedFraud, coverage: "SUFFICIENT", verification: "VERIFIED", findings: ["FRAUD_SCREEN_CLEAR"] });
export const usableUrl: EvidenceAssessment = assessNormalizedEvidence(urlSupportedFixture, { verification: "UNVERIFIED", findings: ["URL_CHECKS_CLEAR"] });
export const insufficientFraud: EvidenceAssessment = assessNormalizedEvidence(fraudOutOfCoverageFixture, { verification: "UNVERIFIED" });
export const contradictedOnchain: EvidenceAssessment = assessNormalizedEvidence(onchainContradictedFixture, { verification: "CONTRADICTED", contradictions: ["provider_not_found_conflicts_with_independent_rpc_existence"] });

// SYNTHETIC POLICY TEST FIXTURE: explicit verified adverse evidence for policy logic only.
export const syntheticVerifiedFraudBlock: EvidenceAssessment = assessEvidence({
  evidence: { ...supportedFraud, confidence: 0.8 },
  coverage: "SUFFICIENT",
  verification: "VERIFIED",
  findings: ["FRAUD_CONFIRMED"],
  reasons: ["synthetic_verified_adverse_policy_fixture"],
});
