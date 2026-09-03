import { createHash, randomUUID } from "node:crypto";
import { assessNormalizedEvidence } from "./evidence-assessment.js";
import { executeGuardedPaidCall, requireExecutionEnvironment, type ExecutionEnvironment, type PaymentFetchFactory } from "./payment-adapter.js";
import { planEvidenceRequirements, type EvidenceRequirementPlan } from "./planner.js";
import { LiveRunLedger } from "./policy.js";
import { deriveResolution, type DecisionResolution } from "./resolution.js";
import { eligibleSelections } from "./selection.js";
import { createDecisionPacket, type DecisionPacket } from "./decision-packet.js";
import { replayDecisionPacket, type DecisionReplay } from "./decision-replay.js";
import type { Intent, Selection, EvidenceAssessment, Miner } from "./types.js";
import type { ProposedAction, ActionDecision } from "./action-policy.js";

// Re-exported so callers can construct the execution environment without
// importing payment-adapter directly (which carries private-key utilities).
export { requireExecutionEnvironment, type ExecutionEnvironment };

export interface SignerStatus {
  signerConfigured: boolean;
  signerPresence: "present" | "missing";
  signerFormat: "valid" | "invalid";
}

export function inspectSignerConfig(env: Record<string, string | undefined>): SignerStatus {
  const key = env.TELEGRAPH_EVM_PRIVATE_KEY?.trim().replace(/^["']|["']$/g, "");
  const presence: "present" | "missing" = key ? "present" : "missing";
  const format: "valid" | "invalid" = Boolean(key && /^0x[a-fA-F0-9]{64}$/.test(key)) ? "valid" : "invalid";
  return {
    signerConfigured: presence === "present" && format === "valid",
    signerPresence: presence,
    signerFormat: format,
  };
}

export function isSignerConfigured(env: Record<string, string | undefined>): boolean {
  return inspectSignerConfig(env).signerConfigured;
}

export type AgentActionState = "AUTHORIZED" | "HELD_FOR_REVIEW" | "REJECTED";

export type IntelligenceOutcome =
  | { status: "acquired"; assessment: EvidenceAssessment; settledMicroUsdc: number; settlementMetadata?: unknown }
  | { status: "discovery_failed"; intent: Intent; reason: string }
  | { status: "no_compatible_miner"; intent: Intent }
  | { status: "call_failed"; intent: Intent; reason: string }
  | { status: "skipped"; intent: Intent; reason: string };

/** Summary of one intelligence acquisition attempt within a reference agent run. */
export interface AcquiredIntelligence {
  intent: Intent;
  /** Run-scoped logical call ID: `<runId>:<INTENT>`. Not user-supplied. */
  logicalCallId: string;
  minerId: string;
  minerName: string;
  rank: number;
  endpoint: string;
  method: string;
  advertisedPriceMicroUsdc: number;
  outcome: IntelligenceOutcome;
}

export interface ReferenceAgentRunResult {
  /** Immutable server-generated run identifier. Not user-supplied. */
  runId: string;
  timestamp: string;
  proposedAction: ProposedAction;
  requirementPlan: EvidenceRequirementPlan;
  acquiredIntelligence: AcquiredIntelligence[];
  evidenceAssessments: EvidenceAssessment[];
  actionDecision: ActionDecision;
  resolution: DecisionResolution;
  agentState: AgentActionState;
  /** Short human label: "Authorization approved" / "Payment authorization held" / "Authorization rejected". */
  agentStateLabel: string;
  /** One-sentence plain-language support statement. */
  agentStateSupport: string;
  decisionPacket: Readonly<DecisionPacket>;
  decisionReplay: DecisionReplay;
  paidCallCount: number;
  totalSettledMicroUsdc: number;
  /** Settlement provenance keyed by run — traceable to this runId. No private keys or raw signatures. */
  settlementProvenance: SettlementProvenance[];
}

export interface SettlementProvenance {
  /** Matches the runId of this result. */
  runId: string;
  /** Matches the run-scoped logicalCallId for this settlement. */
  logicalCallId: string;
  intent: Intent;
  minerId: string;
  minerName: string;
  settledMicroUsdc: number;
  settlementMetadata: unknown;
}

const AGENT_STATE_LABEL: Record<AgentActionState, string> = {
  AUTHORIZED: "Authorization approved",
  HELD_FOR_REVIEW: "Payment authorization held",
  REJECTED: "Authorization rejected",
};

const AGENT_STATE_SUPPORT: Record<AgentActionState, string> = {
  AUTHORIZED: "The agent can proceed under the current policy.",
  HELD_FOR_REVIEW: "The agent did not proceed because the required evidence was not strong enough.",
  REJECTED: "The agent stopped because the evidence contained a verified adverse finding.",
};

function decisionToState(decision: string): AgentActionState {
  if (decision === "ALLOW") return "AUTHORIZED";
  if (decision === "BLOCK") return "REJECTED";
  return "HELD_FOR_REVIEW";
}

/**
 * Generate an immutable server-assigned run ID.
 * The public user never supplies this value.
 */
function generateRunId(): string {
  // UUID entropy + SHA-256 digest ensures global uniqueness and unpredictability
  const entropy = randomUUID();
  const digest = createHash("sha256").update(entropy).digest("hex").slice(0, 24);
  return `run:${digest}`;
}

function buildPayload(intent: Intent, action: ProposedAction, miner: Miner): Record<string, string | number> {
  const props = miner.input_schema?.properties ?? {};
  if (intent === "FRAUD_DETECTION") {
    return {
      query: `Assess risk indicators in a supplier payment authorization request for reference ${action.subject.reference}. State missing evidence explicitly.`,
    };
  }
  if (intent === "URL_SCAN") {
    const url = action.subject.supplierUrl ?? "https://example.com/";
    return { url };
  }
  // ONCHAIN_TX_LOOKUP
  const txHash = action.subject.transactionHash ?? "";
  const req: Record<string, string | number> = {};
  if ("tx_hash" in props) req.tx_hash = txHash;
  else if ("hash" in props) req.hash = txHash;
  else if ("txHash" in props) req.txHash = txHash;
  if ("chain" in props) {
    const allowed = props.chain?.enum;
    const supported = ["base", "base-sepolia", "Base Sepolia"].find((v) => !allowed || allowed.includes(v));
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

/**
 * The Nexora Reference Agent.
 *
 * Demonstrates how an autonomous client submits a proposed action to Nexora,
 * acquires real Telegraph intelligence, and obeys the deterministic policy
 * decision.
 *
 * The reference agent NEVER overrides Nexora. It never transfers money.
 * It changes only its own internal state (AUTHORIZED / HELD_FOR_REVIEW / REJECTED).
 *
 * Identity design:
 * - Every accepted run gets an immutable server-generated runId (not user-supplied).
 * - Logical call IDs are derived as `<runId>:<INTENT>` — unique per run per intent.
 * - The same intent within one run cannot be authorized twice (LiveRunLedger enforces this).
 * - Concurrent runs have distinct runIds and therefore distinct payment identities.
 * - Payment provenance is traceable back to the exact runId.
 */
export async function runReferenceAgent(options: {
  proposedAction: ProposedAction;
  nodeUrl: string;
  fetchRegistry: typeof fetch;
  environment: ExecutionEnvironment;
  paymentFetchFactory?: PaymentFetchFactory;
  unsignedFetch?: typeof fetch;
}): Promise<ReferenceAgentRunResult> {
  const { proposedAction, nodeUrl, fetchRegistry, environment } = options;
  const timestamp = new Date().toISOString();
  const runId = generateRunId();

  // 1. Determine what intelligence is required (deterministic, no network)
  const requirementPlan = planEvidenceRequirements(proposedAction);

  // 2. Fetch the live registry — this is a free call
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
    const acquiredIntelligence: AcquiredIntelligence[] = requirementPlan.requirements
      .filter((r) => r.mandatory)
      .map((req) => ({
        intent: req.intent as Intent,
        logicalCallId: LiveRunLedger.callId(runId, req.intent as Intent),
        minerId: "UNKNOWN",
        minerName: "UNKNOWN",
        rank: 0,
        endpoint: "UNKNOWN",
        method: "UNKNOWN",
        advertisedPriceMicroUsdc: 0,
        outcome: { status: "discovery_failed" as const, intent: req.intent as Intent, reason },
      }));
    const fallbackAssessments = acquiredIntelligence.map((a) =>
      makeFallbackAssessment(a.intent, reason)
    );
    return finalizeRun(runId, timestamp, proposedAction, requirementPlan, acquiredIntelligence, fallbackAssessments, []);
  }

  // 3. For each requirement: select a miner, then execute a guarded paid call
  const ledger = new LiveRunLedger(runId);
  const acquiredIntelligence: AcquiredIntelligence[] = [];
  const evidenceAssessments: EvidenceAssessment[] = [];
  const settlementProvenance: SettlementProvenance[] = [];

  for (const req of requirementPlan.requirements) {
    const intent = req.intent as Intent;
    const logicalCallId = LiveRunLedger.callId(runId, intent);

    let selection: Selection;
    try {
      const eligible = eligibleSelections(registry, intent);
      const top = eligible[0];
      if (!top) {
        acquiredIntelligence.push({
          intent, logicalCallId,
          minerId: "NONE", minerName: "NONE", rank: 0, endpoint: "NONE", method: "NONE",
          advertisedPriceMicroUsdc: 0,
          outcome: { status: "no_compatible_miner", intent },
        });
        evidenceAssessments.push(makeFallbackAssessment(intent, `No compatible provider found for ${intent}`));
        continue;
      }
      selection = top;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Provider selection failed";
      acquiredIntelligence.push({
        intent, logicalCallId,
        minerId: "NONE", minerName: "NONE", rank: 0, endpoint: "NONE", method: "NONE",
        advertisedPriceMicroUsdc: 0,
        outcome: { status: "no_compatible_miner", intent },
      });
      evidenceAssessments.push(makeFallbackAssessment(intent, reason));
      continue;
    }

    const payload = buildPayload(intent, proposedAction, selection.miner);

    try {
      const capture = await executeGuardedPaidCall({
        nodeUrl,
        logicalTestId: logicalCallId,
        intent,
        selection,
        payload,
        environment,
        ledger,
        ...(options.unsignedFetch !== undefined ? { unsignedFetch: options.unsignedFetch } : {}),
        ...(options.paymentFetchFactory !== undefined ? { paymentFetchFactory: options.paymentFetchFactory } : {}),
      });

      const settled = capture.settlementOccurred ? (capture.authorizedAmount ?? 0) : 0;

      let assessment: EvidenceAssessment;
      if (capture.normalizedEvidence) {
        assessment = assessNormalizedEvidence(capture.normalizedEvidence, {
          verification: capture.settlementOccurred ? "UNVERIFIED" : "NOT_APPLICABLE",
        });
      } else {
        assessment = makeFallbackAssessment(intent, "Provider returned no parseable evidence");
      }

      evidenceAssessments.push(assessment);
      acquiredIntelligence.push({
        intent, logicalCallId,
        minerId: selection.miner.id,
        minerName: selection.miner.name,
        rank: selection.score.rank,
        endpoint: selection.endpoint.path,
        method: selection.endpoint.method,
        advertisedPriceMicroUsdc: selection.miner.min_price_usdc,
        outcome: { status: "acquired", assessment, settledMicroUsdc: settled, settlementMetadata: capture.settlementMetadata },
      });

      if (capture.settlementOccurred) {
        settlementProvenance.push({
          runId,
          logicalCallId,
          intent,
          minerId: selection.miner.id,
          minerName: selection.miner.name,
          settledMicroUsdc: settled,
          settlementMetadata: capture.settlementMetadata ?? null,
        });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Intelligence acquisition failed";
      acquiredIntelligence.push({
        intent, logicalCallId,
        minerId: selection.miner.id,
        minerName: selection.miner.name,
        rank: selection.score.rank,
        endpoint: selection.endpoint.path,
        method: selection.endpoint.method,
        advertisedPriceMicroUsdc: selection.miner.min_price_usdc,
        outcome: { status: "call_failed", intent, reason },
      });
      evidenceAssessments.push(makeFallbackAssessment(intent, reason));
    }
  }

  return finalizeRun(runId, timestamp, proposedAction, requirementPlan, acquiredIntelligence, evidenceAssessments, settlementProvenance);
}

function finalizeRun(
  runId: string,
  timestamp: string,
  proposedAction: ProposedAction,
  requirementPlan: EvidenceRequirementPlan,
  acquiredIntelligence: AcquiredIntelligence[],
  evidenceAssessments: EvidenceAssessment[],
  settlementProvenance: SettlementProvenance[],
): ReferenceAgentRunResult {
  const decisionPacket = createDecisionPacket(runId, proposedAction, evidenceAssessments);
  const decisionReplay = replayDecisionPacket(decisionPacket);
  const actionDecision = decisionPacket.actionDecision;
  const agentState = decisionToState(actionDecision.decision);
  const resolution = deriveResolution(actionDecision, requirementPlan.requirements, evidenceAssessments);
  const paidCallCount = settlementProvenance.length;
  const totalSettledMicroUsdc = settlementProvenance.reduce((sum, p) => sum + p.settledMicroUsdc, 0);

  return {
    runId,
    timestamp,
    proposedAction,
    requirementPlan,
    acquiredIntelligence,
    evidenceAssessments,
    actionDecision,
    resolution,
    agentState,
    agentStateLabel: AGENT_STATE_LABEL[agentState],
    agentStateSupport: AGENT_STATE_SUPPORT[agentState],
    decisionPacket,
    decisionReplay,
    paidCallCount,
    totalSettledMicroUsdc,
    settlementProvenance,
  };
}
