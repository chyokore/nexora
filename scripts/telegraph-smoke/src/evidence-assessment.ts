import type {
  Conformance,
  DomainEvidence,
  EvidenceAssessment,
  EvidenceCoverage,
  EvidenceQuality,
  EvidenceVerification,
} from "./types.js";

export interface EvidenceAssessmentInput {
  evidence: DomainEvidence;
  coverage: EvidenceCoverage;
  verification: EvidenceVerification;
  reasons?: readonly string[];
  uncertainties?: readonly string[];
  contradictions?: readonly string[];
  missingEvidence?: readonly string[];
}

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort();

function qualityFor(structure: Conformance, coverage: EvidenceCoverage, verification: EvidenceVerification): EvidenceQuality {
  if (structure === "INVALID" || structure === "MISMATCH") return "INVALID";
  if (verification === "CONTRADICTED") return "CONTRADICTED";
  if (coverage === "OUT_OF_COVERAGE") return "INSUFFICIENT";
  if (coverage === "UNKNOWN" || coverage === "PARTIAL") return "LIMITED";
  if (verification === "VERIFIED") return "STRONG";
  if (verification === "PARTIALLY_VERIFIED" || verification === "UNVERIFIED" || verification === "NOT_APPLICABLE") return "USABLE";
  return "LIMITED";
}

function policyReasons(structure: Conformance, coverage: EvidenceCoverage, verification: EvidenceVerification): string[] {
  if (structure === "INVALID") return ["response_contract_invalid"];
  if (structure === "MISMATCH") return ["response_contract_mismatch_without_validated_adapter"];
  if (verification === "CONTRADICTED") return ["independent_evidence_contradicts_provider_fact"];
  if (coverage === "OUT_OF_COVERAGE") return ["provider_lacked_relevant_coverage"];
  if (coverage === "UNKNOWN") return ["evidence_coverage_unknown"];
  if (coverage === "PARTIAL") return ["evidence_coverage_partial"];
  if (verification === "VERIFIED") return ["relevant_evidence_independently_verified"];
  if (verification === "PARTIALLY_VERIFIED") return ["relevant_evidence_partially_verified"];
  if (verification === "UNVERIFIED") return ["relevant_provider_evidence_not_independently_verified"];
  return ["independent_verification_not_applicable"];
}

/** Pure, provider-neutral policy. Confidence is preserved as data and never ranks quality. */
export function assessEvidence(input: EvidenceAssessmentInput): EvidenceAssessment {
  const { evidence, coverage, verification } = input;
  const contradictions = uniqueSorted(input.contradictions ?? []);
  const effectiveVerification: EvidenceVerification = verification === "CONTRADICTED" || contradictions.length > 0 ? "CONTRADICTED" : verification;
  return {
    intent: evidence.intent,
    structuralValidity: evidence.validationStatus,
    coverage,
    verification: effectiveVerification,
    ...(evidence.confidence === undefined ? {} : { providerConfidence: evidence.confidence }),
    quality: qualityFor(evidence.validationStatus, coverage, effectiveVerification),
    reasons: uniqueSorted([...policyReasons(evidence.validationStatus, coverage, effectiveVerification), ...(input.reasons ?? [])]),
    uncertainties: uniqueSorted([...evidence.uncertainty, ...(input.uncertainties ?? [])]),
    contradictions,
    missingEvidence: uniqueSorted([...evidence.unavailableFields, ...(input.missingEvidence ?? [])]),
  };
}

export interface DomainAssessmentContext {
  verification: EvidenceVerification;
  contradictions?: readonly string[];
  missingEvidence?: readonly string[];
}

/** Intent adapter: extracts coverage and scoped uncertainty before generic policy runs. */
export function assessNormalizedEvidence(evidence: DomainEvidence, context: DomainAssessmentContext): EvidenceAssessment {
  if (evidence.intent === "FRAUD_DETECTION") {
    const abstained = evidence.label === "out_of_coverage" || evidence.uncertainty.includes("insufficient_data") || evidence.uncertainty.includes("coverage_incomplete");
    return assessEvidence({
      evidence,
      coverage: abstained ? "OUT_OF_COVERAGE" : evidence.label === undefined ? "UNKNOWN" : "SUFFICIENT",
      verification: abstained ? "NOT_APPLICABLE" : context.verification,
      ...(context.contradictions === undefined ? {} : { contradictions: context.contradictions }),
      missingEvidence: [...(context.missingEvidence ?? []), ...(abstained ? ["supported_fraud_finding"] : [])],
    });
  }
  if (evidence.intent === "URL_SCAN") {
    const supported = evidence.queriedUrl !== undefined && evidence.verdict !== undefined && evidence.safe !== undefined && evidence.sources !== undefined;
    return assessEvidence({
      evidence,
      coverage: supported ? "SUFFICIENT" : "PARTIAL",
      verification: context.verification,
      ...(context.contradictions === undefined ? {} : { contradictions: context.contradictions }),
      ...(context.missingEvidence === undefined ? {} : { missingEvidence: context.missingEvidence }),
      uncertainties: ["point_in_time_scan", "finite_provider_coverage", "no_future_safety_guarantee"],
    });
  }
  const relevantClaim = evidence.intent === "ONCHAIN_TX_LOOKUP" ? evidence.transactionStatus !== undefined : evidence.verdict !== undefined;
  return assessEvidence({
    evidence,
    coverage: relevantClaim ? "SUFFICIENT" : "UNKNOWN",
    verification: context.verification,
    ...(context.contradictions === undefined ? {} : { contradictions: context.contradictions }),
    ...(context.missingEvidence === undefined ? {} : { missingEvidence: context.missingEvidence }),
  });
}

/** Stable because assessments have fixed property order and sorted set-like fields. */
export function serializeEvidenceAssessment(assessment: EvidenceAssessment): string {
  return JSON.stringify(assessment);
}
