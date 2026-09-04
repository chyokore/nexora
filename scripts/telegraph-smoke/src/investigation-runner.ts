import { createHash, randomUUID } from "node:crypto";
import { assessNormalizedEvidence } from "./evidence-assessment.js";
import { executeGuardedPaidCall, type ExecutionEnvironment, type PaymentFetchFactory } from "./payment-adapter.js";
import { planInvestigationRequirements, type InvestigationPlan } from "./investigation-planner.js";
import { evaluateInvestigationPolicy, type InvestigationDecision } from "./investigation-policy.js";
import { LiveRunLedger } from "./policy.js";
import { eligibleSelections, selectionExplanation } from "./selection.js";
import { replayDecisionPacket, type DecisionReplay } from "./decision-replay.js";
import { createDecisionPacket, type DecisionPacket } from "./decision-packet.js";
import type {
  InvestigationInput, InvestigationVerdict, Intent, Selection, EvidenceAssessment,
  Miner, SanitizedRequestSummary, EvidenceQuestionTrace, MinerRequestTrace, MinerResponseTrace,
} from "./types.js";
import type { ProposedAction } from "./action-policy.js";

export type { InvestigationPlan, InvestigationDecision };

// ---------------------------------------------------------------------------
// Result interfaces
// ---------------------------------------------------------------------------

export interface InvestigationAcquiredIntelligence {
  intent: Intent;
  logicalCallId: string;
  minerId: string;
  minerName: string;
  rank: number;
  endpoint: string;
  method: string;
  advertisedPriceMicroUsdc: number;
  selectionExplanation: string;
  requestSummary: SanitizedRequestSummary;
  outcome:
    | { status: "acquired"; assessment: EvidenceAssessment; settledMicroUsdc: number; settlementMetadata?: unknown }
    | { status: "discovery_failed"; intent: Intent; reason: string }
    | { status: "no_compatible_miner"; intent: Intent }
    | { status: "call_failed"; intent: Intent; reason: string };
}

export interface InvestigationSettlementProvenance {
  runId: string;
  logicalCallId: string;
  intent: Intent;
  minerId: string;
  minerName: string;
  settledMicroUsdc: number;
  settlementMetadata: unknown;
}

export interface InvestigationRunResult {
  runId: string;
  timestamp: string;
  mode: "INVESTIGATE";
  question: string;
  investigationPlan: InvestigationPlan;
  evidenceQuestions: EvidenceQuestionTrace[];
  acquiredIntelligence: InvestigationAcquiredIntelligence[];
  evidenceAssessments: EvidenceAssessment[];
  investigationDecision: InvestigationDecision;
  verdict: InvestigationVerdict;
  verdictLabel: string;
  verdictSupport: string;
  /** The investigation verdict is mapped onto a fake ProposedAction for Decision Replay compatibility. */
  decisionPacket: Readonly<DecisionPacket>;
  decisionReplay: DecisionReplay;
  paidCallCount: number;
  totalSettledMicroUsdc: number;
  settlementProvenance: InvestigationSettlementProvenance[];
  unsupportedAspects: string[];
}

// ---------------------------------------------------------------------------
// Verdict labels
// ---------------------------------------------------------------------------

const VERDICT_LABEL: Record<InvestigationVerdict, string> = {
  SUPPORTED:    "Evidence supports the claim",
  DISPUTED:     "Evidence contradicts or disputes the claim",
  INCONCLUSIVE: "Evidence is insufficient to reach a conclusion",
};

const VERDICT_SUPPORT: Record<InvestigationVerdict, string> = {
  SUPPORTED:    "All planned evidence requirements were satisfied at or above the required quality threshold.",
  DISPUTED:     "One or more evidence items are contradicted or contain verified adverse findings.",
  INCONCLUSIVE: "Required evidence is missing, insufficient, or below the minimum quality needed to reach a conclusion.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRunId(): string {
  const entropy = randomUUID();
  const digest = createHash("sha256").update(entropy).digest("hex").slice(0, 24);
  return `run:${digest}`;
}

/**
 * Build a Telegraph payload for an investigation intent.
 * URL and tx_hash come from the investigation plan (not a ProposedAction).
 */
function buildInvestigationPayload(
  intent: Intent,
  plan: InvestigationPlan,
  miner: Miner
): Record<string, string | number> {
  const props = miner.input_schema?.properties ?? {};
  if (intent === "URL_SCAN") {
    return { url: plan.urlTarget ?? "https://example.com/" };
  }
  if (intent === "FRAUD_DETECTION") {
    return {
      query: `Investigate potential fraud or risk indicators for the following question: ${plan.userQuestion}. State missing evidence explicitly.`,
    };
  }
  // ONCHAIN_TX_LOOKUP
  const txHash = plan.txHashTarget ?? "";
  const req: Record<string, string | number> = {};
  if ("tx_hash" in props) req.tx_hash = txHash;
  else if ("hash" in props) req.hash = txHash;
  else if ("txHash" in props) req.txHash = txHash;
  if ("chain" in props) {
    const allowed = props.chain?.enum;
    const supported = ["base", "base-sepolia", "Base Sepolia"].find(
      (v) => !allowed || (Array.isArray(allowed) && allowed.includes(v))
    );
    if (supported) req.chain = supported;
  }
  if ("chainId" in props) req.chainId = 84532;
  if ((miner.input_schema?.required ?? []).includes("query")) {
    req.query = `Look up transaction ${txHash} on Base Sepolia`;
  }
  return req;
}

function makeFallbackAssessment(intent: Intent, reason: string): EvidenceAssessment {
  return {
    intent,
    structuralValidity: "INVALID",
    coverage: "UNKNOWN",
    verification: "UNVERIFIED",
    quality: "INVALID",
    reasons: ["intelligence_acquisition_failed"],
    findings: [],
    providerFacts: {},
    uncertainties: [reason],
    contradictions: [],
    missingEvidence: [`${intent} evidence could not be acquired`],
  };
}

// Build a minimal ProposedAction for DecisionPacket / Replay compatibility
function syntheticAction(plan: InvestigationPlan): ProposedAction {
  return {
    id: "investigation-run",
    type: "SUPPLIER_PAYMENT_AUTHORIZATION",
    description: plan.userQuestion,
    subject: {
      kind: "SUPPLIER_PAYMENT",
      reference: "investigation",
      ...(plan.urlTarget ? { supplierUrl: plan.urlTarget } : {}),
      ...(plan.txHashTarget ? { transactionHash: plan.txHashTarget } : {}),
    },
    riskClass: "HIGH",
  };
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

export async function runInvestigation(options: {
  input: InvestigationInput;
  nodeUrl: string;
  fetchRegistry: typeof fetch;
  environment: ExecutionEnvironment;
  paymentFetchFactory?: PaymentFetchFactory;
  unsignedFetch?: typeof fetch;
}): Promise<InvestigationRunResult> {
  const { input, nodeUrl, fetchRegistry, environment } = options;
  const timestamp = new Date().toISOString();
  const runId = generateRunId();

  // 1. Deterministic planning
  const plan = planInvestigationRequirements(input);

  if (plan.requirements.length === 0) {
    // No routable requirements → return immediately without paid calls
    const decision = evaluateInvestigationPolicy([], []);
    return buildResult(runId, timestamp, input, plan, [], [], [], decision);
  }

  // 2. Fetch registry (free call)
  let registry: Miner[];
  try {
    const regUrl = new URL("/miner-dispatcher/integrations", nodeUrl);
    const res = await fetchRegistry(regUrl as unknown as URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Registry returned HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Malformed registry result: expected an array");
    registry = data as Miner[];
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Registry fetch failed";
    const acquiredIntelligence: InvestigationAcquiredIntelligence[] = plan.requirements
      .filter((r) => r.mandatory)
      .map((req) => ({
        intent: req.intent as Intent,
        logicalCallId: LiveRunLedger.callId(runId, req.intent as Intent),
        minerId: "UNKNOWN", minerName: "UNKNOWN", rank: 0, endpoint: "UNKNOWN", method: "UNKNOWN",
        advertisedPriceMicroUsdc: 0,
        selectionExplanation: `Discovery failed: ${reason}`,
        requestSummary: { endpoint: "UNKNOWN", method: "UNKNOWN", intent: req.intent as Intent, minerId: "UNKNOWN", minerName: "UNKNOWN", parameters: {} },
        outcome: { status: "discovery_failed" as const, intent: req.intent as Intent, reason },
      }));
    const fallbackAssessments = acquiredIntelligence.map((a) => makeFallbackAssessment(a.intent, reason));
    const decision = evaluateInvestigationPolicy(plan.requirements, fallbackAssessments);
    return buildResult(runId, timestamp, input, plan, acquiredIntelligence, fallbackAssessments, [], decision);
  }

  // 3. Execute paid calls per requirement
  const ledger = new LiveRunLedger(runId);
  const acquiredIntelligence: InvestigationAcquiredIntelligence[] = [];
  const evidenceAssessments: EvidenceAssessment[] = [];
  const settlementProvenance: InvestigationSettlementProvenance[] = [];

  for (const req of plan.requirements) {
    const intent = req.intent as Intent;
    const logicalCallId = LiveRunLedger.callId(runId, intent);

    let selection: Selection;
    try {
      const eligible = eligibleSelections(registry, intent);
      const top = eligible[0];
      if (!top) {
        acquiredIntelligence.push({
          intent, logicalCallId, minerId: "NONE", minerName: "NONE", rank: 0, endpoint: "NONE", method: "NONE",
          advertisedPriceMicroUsdc: 0,
          selectionExplanation: `No active, schema-compatible provider found for ${intent}.`,
          requestSummary: { endpoint: "NONE", method: "NONE", intent, minerId: "NONE", minerName: "NONE", parameters: {} },
          outcome: { status: "no_compatible_miner", intent },
        });
        evidenceAssessments.push(makeFallbackAssessment(intent, `No compatible provider found for ${intent}`));
        continue;
      }
      selection = top;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Provider selection failed";
      acquiredIntelligence.push({
        intent, logicalCallId, minerId: "NONE", minerName: "NONE", rank: 0, endpoint: "NONE", method: "NONE",
        advertisedPriceMicroUsdc: 0,
        selectionExplanation: `Provider selection failed: ${reason}`,
        requestSummary: { endpoint: "NONE", method: "NONE", intent, minerId: "NONE", minerName: "NONE", parameters: {} },
        outcome: { status: "no_compatible_miner", intent },
      });
      evidenceAssessments.push(makeFallbackAssessment(intent, reason));
      continue;
    }

    const payload = buildInvestigationPayload(intent, plan, selection.miner);
    const selExpl = selectionExplanation(selection, intent);
    const reqSummary: SanitizedRequestSummary = {
      endpoint: selection.endpoint.path,
      method: selection.endpoint.method,
      intent,
      minerId: selection.miner.id,
      minerName: selection.miner.name,
      parameters: structuredClone(payload),
    };

    try {
      const capture = await executeGuardedPaidCall({
        nodeUrl, logicalTestId: logicalCallId, intent, selection, payload, environment, ledger,
        ...(options.unsignedFetch !== undefined ? { unsignedFetch: options.unsignedFetch } : {}),
        ...(options.paymentFetchFactory !== undefined ? { paymentFetchFactory: options.paymentFetchFactory } : {}),
      });

      const settled = capture.settlementOccurred ? (capture.authorizedAmount ?? 0) : 0;
      const assessment = capture.normalizedEvidence
        ? assessNormalizedEvidence(capture.normalizedEvidence, {
            verification: capture.settlementOccurred ? "UNVERIFIED" : "NOT_APPLICABLE",
          })
        : makeFallbackAssessment(intent, "Provider returned no parseable evidence");

      evidenceAssessments.push(assessment);
      acquiredIntelligence.push({
        intent, logicalCallId,
        minerId: selection.miner.id, minerName: selection.miner.name, rank: selection.score.rank,
        endpoint: selection.endpoint.path, method: selection.endpoint.method,
        advertisedPriceMicroUsdc: selection.miner.min_price_usdc,
        selectionExplanation: selExpl, requestSummary: reqSummary,
        outcome: { status: "acquired", assessment, settledMicroUsdc: settled, settlementMetadata: capture.settlementMetadata },
      });

      if (capture.settlementOccurred) {
        settlementProvenance.push({
          runId, logicalCallId, intent,
          minerId: selection.miner.id, minerName: selection.miner.name,
          settledMicroUsdc: settled,
          settlementMetadata: capture.settlementMetadata ?? null,
        });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Intelligence acquisition failed";
      acquiredIntelligence.push({
        intent, logicalCallId,
        minerId: selection.miner.id, minerName: selection.miner.name, rank: selection.score.rank,
        endpoint: selection.endpoint.path, method: selection.endpoint.method,
        advertisedPriceMicroUsdc: selection.miner.min_price_usdc,
        selectionExplanation: selExpl, requestSummary: reqSummary,
        outcome: { status: "call_failed", intent, reason },
      });
      evidenceAssessments.push(makeFallbackAssessment(intent, reason));
    }
  }

  const decision = evaluateInvestigationPolicy(plan.requirements, evidenceAssessments);
  return buildResult(runId, timestamp, input, plan, acquiredIntelligence, evidenceAssessments, settlementProvenance, decision);
}

// ---------------------------------------------------------------------------
// Result builder
// ---------------------------------------------------------------------------

function buildResult(
  runId: string,
  timestamp: string,
  input: InvestigationInput,
  plan: InvestigationPlan,
  acquiredIntelligence: InvestigationAcquiredIntelligence[],
  evidenceAssessments: EvidenceAssessment[],
  settlementProvenance: InvestigationSettlementProvenance[],
  decision: InvestigationDecision,
): InvestigationRunResult {
  const synthetic = syntheticAction(plan);
  const decisionPacket = createDecisionPacket(runId, synthetic, evidenceAssessments, plan.userQuestion);
  const decisionReplay = replayDecisionPacket(decisionPacket);

  const evidenceQuestions: EvidenceQuestionTrace[] = plan.requirements.map((req) => {
    const matchingIntel = acquiredIntelligence.filter((a) => a.intent === req.intent);

    const minerRequests: MinerRequestTrace[] = matchingIntel.map((ai) => ({
      minerId: ai.minerId, minerName: ai.minerName, rank: ai.rank,
      endpoint: ai.endpoint, method: ai.method,
      advertisedPriceMicroUsdc: ai.advertisedPriceMicroUsdc,
      selectionExplanation: ai.selectionExplanation,
      requestSummary: ai.requestSummary,
    }));

    const minerResponses: MinerResponseTrace[] = matchingIntel.map((ai) => {
      const outcome = ai.outcome;
      if (outcome.status === "acquired") {
        return {
          minerId: ai.minerId, minerName: ai.minerName,
          status: outcome.status, settledMicroUsdc: outcome.settledMicroUsdc,
          ...(outcome.assessment.providerConfidence !== undefined ? { providerConfidence: outcome.assessment.providerConfidence } : {}),
          ...(outcome.assessment.providerFacts ? { providerFacts: outcome.assessment.providerFacts } : {}),
        };
      }
      return {
        minerId: ai.minerId, minerName: ai.minerName,
        status: outcome.status, settledMicroUsdc: 0,
        ...("reason" in outcome && outcome.reason ? { reason: outcome.reason } : {}),
      };
    });

    const isSatisfied = decision.satisfiedRequirements.includes(req.id ?? req.intent);
    const isDisputed = decision.disputedRequirements.includes(req.id ?? req.intent);
    const reqStatus: EvidenceQuestionTrace["requirementStatus"] = isDisputed
      ? "BLOCKING"
      : isSatisfied
      ? "SATISFIED"
      : req.mandatory
      ? "UNSATISFIED"
      : "OPTIONAL";

    return {
      id: req.id ?? `req-${req.intent.toLowerCase()}`,
      question: req.question ?? `Verify ${req.intent} evidence`,
      whyItMatters: req.whyItMatters ?? req.rationale,
      intent: req.intent,
      mandatory: req.mandatory,
      minimumQuality: req.minimumQuality,
      reasonCode: req.reasonCode,
      condition: req.condition,
      minerRequests,
      minerResponses,
      requirementStatus: reqStatus,
      decisionContribution: isDisputed
        ? "This evidence is disputed — it contradicts or conflicts with expected findings."
        : isSatisfied
        ? "This evidence supports the investigation conclusion."
        : "This evidence is missing or insufficient — it prevents a supported conclusion.",
    };
  });

  return {
    runId,
    timestamp,
    mode: "INVESTIGATE",
    question: input.question,
    investigationPlan: plan,
    evidenceQuestions,
    acquiredIntelligence,
    evidenceAssessments,
    investigationDecision: decision,
    verdict: decision.verdict,
    verdictLabel: VERDICT_LABEL[decision.verdict],
    verdictSupport: VERDICT_SUPPORT[decision.verdict],
    decisionPacket,
    decisionReplay,
    paidCallCount: settlementProvenance.length,
    totalSettledMicroUsdc: settlementProvenance.reduce((s, p) => s + p.settledMicroUsdc, 0),
    settlementProvenance,
    unsupportedAspects: plan.unsupportedAspects,
  };
}
