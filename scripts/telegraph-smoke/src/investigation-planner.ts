import type { DecisionSource, InvestigationInput } from "./types.js";
import type { PlannedRequirement, EvidenceRequirementPlan } from "./planner.js";

/**
 * Deterministic investigation planner.
 *
 * Maps an InvestigationInput to an EvidenceRequirementPlan — no LLM, no
 * network call, no randomness. The same input always produces the same plan.
 *
 * Routing rules:
 *  - Any source with type "URL"               → URL_SCAN
 *  - Any source with type "ONCHAIN_REFERENCE" → ONCHAIN_TX_LOOKUP
 *  - Fraud / scam keywords in the question    → FRAUD_DETECTION
 *  - No recognizable routing                  → empty requirements (returns
 *    plan with userQuestion noting unsupported aspects)
 */

const FRAUD_KEYWORDS = [
  "fraud", "scam", "fake", "phishing", "suspicious", "risk", "threat",
  "malicious", "deceptive", "spam", "abuse", "stolen", "compromised",
];

function hasFraudKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return FRAUD_KEYWORDS.some((kw) => lower.includes(kw));
}

function urlSource(sources: DecisionSource[] | undefined): DecisionSource | undefined {
  return sources?.find((s) => s.type === "URL");
}

function onchainSource(sources: DecisionSource[] | undefined): DecisionSource | undefined {
  return sources?.find((s) => s.type === "ONCHAIN_REFERENCE");
}

export interface InvestigationPlan extends EvidenceRequirementPlan {
  /** URL extracted from sources, if a URL source was present. */
  urlTarget?: string | undefined;
  /** Transaction hash extracted from sources, if an onchain reference was present. */
  txHashTarget?: string | undefined;
  /** Any aspects of the user question that Nexora cannot route to a miner. */
  unsupportedAspects: string[];
}

export function planInvestigationRequirements(input: InvestigationInput): InvestigationPlan {
  const requirements: PlannedRequirement[] = [];
  const unsupportedAspects: string[] = [];

  const url = urlSource(input.sources);
  const onchain = onchainSource(input.sources);
  const wantsFraud = hasFraudKeyword(input.question) || hasFraudKeyword(input.context ?? "");

  if (url) {
    requirements.push({
      id: "req-url-scan",
      question: "Does the supplied URL show signs of phishing, malware, or known malicious activity?",
      whyItMatters: "The URL is a primary source in this investigation — its safety directly affects the conclusion.",
      intent: "URL_SCAN",
      mandatory: true,
      minimumQuality: "USABLE",
      reasonCode: "URL_EVIDENCE_REQUIRED",
      rationale: "A URL source was supplied; safety must be verified before returning a conclusion.",
      condition: "Required when a URL source is present.",
    });
  }

  if (onchain) {
    requirements.push({
      id: "req-onchain-tx",
      question: "Does the referenced transaction exist on the claimed network and match the information provided?",
      whyItMatters: "The investigation relies on an onchain claim that must be independently verifiable.",
      intent: "ONCHAIN_TX_LOOKUP",
      mandatory: true,
      minimumQuality: "USABLE",
      reasonCode: "ONCHAIN_EVIDENCE_REQUIRED",
      rationale: "An onchain reference was supplied; it must be verified before returning a conclusion.",
      condition: "Required when an onchain reference is present.",
    });
  }

  if (wantsFraud) {
    requirements.push({
      id: "req-fraud-detection",
      question: "Are there credible fraud or risk indicators associated with this inquiry?",
      whyItMatters: "The question mentions fraud-related concepts that require active screening.",
      intent: "FRAUD_DETECTION",
      mandatory: true,
      minimumQuality: "USABLE",
      reasonCode: "FRAUD_EVIDENCE_REQUIRED",
      rationale: "Fraud/scam keywords detected in the investigation question.",
      condition: "Required when fraud-related keywords are present in the question or context.",
    });
  }

  if (requirements.length === 0) {
    unsupportedAspects.push(
      "The question does not contain a URL, onchain reference, or recognized fraud keywords. " +
      "Add a URL or transaction hash to enable live Telegraph evidence acquisition."
    );
  }

  // Sort for determinism
  requirements.sort((a, b) => a.intent.localeCompare(b.intent));

  return {
    userQuestion: input.question,
    actionType: "SUPPLIER_PAYMENT_AUTHORIZATION", // schema reuse — investigation mode overrides rendering
    riskClass: "HIGH",
    requirements,
    ...(url ? { urlTarget: url.value } : {}),
    ...(onchain ? { txHashTarget: onchain.value } : {}),
    unsupportedAspects,
  };
}
