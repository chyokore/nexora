import { createHash } from "node:crypto";
import { ACTION_DECISIONS, evaluateRecordedPolicy, supplierPaymentPolicy, type ActionDecision, type ActionDecisionValue, type ActionPolicySnapshot, type ProposedAction } from "./action-policy.js";
import type { DecisionPacket } from "./decision-packet.js";
import type { EvidenceAssessment } from "./types.js";

export type ReplayStatus = "VERIFIED" | "MISMATCH" | "INVALID_PACKET" | "UNSUPPORTED_VERSION";
export interface ReplayValidation { status: ReplayStatus; packetVersion: number | null; recordedDecision: ActionDecisionValue | null; recomputedDecision: ActionDecisionValue | null; matches: boolean; mismatches: string[]; warnings: string[]; }
export interface ReplayEvent { order: number; type: "ACTION_PROPOSED" | "EVIDENCE_REQUIRED" | "EVIDENCE_ASSESSED" | "CONTRADICTION_OR_GAP" | "POLICY_EVALUATED" | "DECISION_RECORDED" | "DECISION_RECOMPUTED" | "REPLAY_VERIFIED" | "REPLAY_MISMATCH" | "REPLAY_REJECTED"; title: string; summary: string; details: Record<string, unknown>; }
export interface DecisionReplay { version: 1; replayId: string; packetVersion: number | null; decisionId: string | null; fingerprint: string | null; validation: ReplayValidation; proposedAction: ProposedAction | null; evidence: EvidenceAssessment[]; policyEvaluation: ActionPolicySnapshot | null; recordedDecision: ActionDecision | null; recomputedDecision: ActionDecision | null; timeline: ReplayEvent[]; postDecisionOutcome: "NOT_RECORDED"; }

const decisions = new Set<string>(ACTION_DECISIONS);
const conformances = new Set(["MATCH", "COMPATIBLE_WITH_ADAPTER", "MISMATCH", "INVALID"]);
const coverages = new Set(["SUFFICIENT", "PARTIAL", "OUT_OF_COVERAGE", "UNKNOWN"]);
const verifications = new Set(["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "CONTRADICTED", "NOT_APPLICABLE"]);
const qualities = new Set(["STRONG", "USABLE", "LIMITED", "INSUFFICIENT", "CONTRADICTED", "INVALID"]);
const intents = new Set(["FRAUD_DETECTION", "URL_SCAN", "ONCHAIN_TX_LOOKUP", "FACT_CHECK", "NEWS_SEARCH"]);
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const onlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).every((key) => keys.includes(key));
const sorted = (values: readonly string[]): string[] => [...values].sort();

export function canonicalSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function fingerprintDecisionPacket(packet: DecisionPacket): string {
  return createHash("sha256").update(canonicalSerialize(sanitizeReplayValue(packet))).digest("hex");
}

const sensitiveKey = /private.?key|seed.?phrase|mnemonic|authorization.?signature|payment.?signature|api.?key|bearer|secret|\.env/i;
export function sanitizeReplayValue(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (typeof value === "string" && /^Bearer\s+/i.test(value)) return "[REDACTED]";
  if (typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value) && !/transaction.?hash|receipt|address/i.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => sanitizeReplayValue(item));
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((childKey) => [childKey, sanitizeReplayValue(value[childKey], childKey)]));
  return value;
}

function isJsonValue(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return true;
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return (Array.isArray(value) ? value : Object.values(value)).every((item) => isJsonValue(item, seen));
}

function validateAction(value: unknown): value is ProposedAction {
  if (!isRecord(value) || !onlyKeys(value, ["id", "type", "description", "subject", "riskClass"]) || typeof value.id !== "string" || value.type !== "SUPPLIER_PAYMENT_AUTHORIZATION" || typeof value.description !== "string" || value.riskClass !== "HIGH" || !isRecord(value.subject)) return false;
  return onlyKeys(value.subject, ["kind", "reference", "supplierUrl", "transactionHash"]) && value.subject.kind === "SUPPLIER_PAYMENT" && typeof value.subject.reference === "string" && (value.subject.supplierUrl === undefined || typeof value.subject.supplierUrl === "string") && (value.subject.transactionHash === undefined || typeof value.subject.transactionHash === "string");
}

function validateAssessment(value: unknown): value is EvidenceAssessment {
  if (!isRecord(value) || !onlyKeys(value, ["intent", "structuralValidity", "coverage", "verification", "providerConfidence", "quality", "reasons", "findings", "providerFacts", "uncertainties", "contradictions", "missingEvidence"])) return false;
  return typeof value.intent === "string" && intents.has(value.intent) && typeof value.structuralValidity === "string" && conformances.has(value.structuralValidity) && typeof value.coverage === "string" && coverages.has(value.coverage) && typeof value.verification === "string" && verifications.has(value.verification) && (value.providerConfidence === undefined || typeof value.providerConfidence === "number" && Number.isFinite(value.providerConfidence)) && typeof value.quality === "string" && qualities.has(value.quality) && stringArray(value.reasons) && stringArray(value.findings) && (value.providerFacts === undefined || isRecord(value.providerFacts) && isJsonValue(value.providerFacts)) && stringArray(value.uncertainties) && stringArray(value.contradictions) && stringArray(value.missingEvidence);
}

function validateRequirement(value: unknown): boolean {
  if (!isRecord(value) || !onlyKeys(value, ["id", "intent", "required", "minimumQuality", "contradictionRule", "requiredFindings", "blockingFindings"])) return false;
  return typeof value.id === "string" && typeof value.intent === "string" && intents.has(value.intent) && typeof value.required === "boolean" && (value.minimumQuality === "USABLE" || value.minimumQuality === "STRONG") && (value.contradictionRule === "REVIEW" || value.contradictionRule === "BLOCK") && stringArray(value.requiredFindings) && stringArray(value.blockingFindings);
}

function validatePolicy(value: unknown): value is ActionPolicySnapshot {
  return isRecord(value) && onlyKeys(value, ["id", "version", "actionType", "requirements"]) && value.id === "supplier-payment-authorization-v1" && value.version === 1 && value.actionType === "SUPPLIER_PAYMENT_AUTHORIZATION" && Array.isArray(value.requirements) && value.requirements.every(validateRequirement);
}

function validateDecision(value: unknown): value is ActionDecision {
  return isRecord(value) && onlyKeys(value, ["decision", "reasons", "satisfiedRequirements", "unsatisfiedRequirements", "blockingEvidence", "reviewEvidence"]) && typeof value.decision === "string" && decisions.has(value.decision) && stringArray(value.reasons) && stringArray(value.satisfiedRequirements) && stringArray(value.unsatisfiedRequirements) && stringArray(value.blockingEvidence) && stringArray(value.reviewEvidence);
}

function validatePacket(value: unknown): { packet?: DecisionPacket; status?: ReplayStatus; errors: string[]; packetVersion: number | null } {
  if (!isRecord(value)) return { status: "INVALID_PACKET", errors: ["packet:not_object"], packetVersion: null };
  if (!("version" in value)) return { status: "INVALID_PACKET", errors: ["packet:missing_version"], packetVersion: null };
  if (typeof value.version !== "number" || !Number.isInteger(value.version)) return { status: "INVALID_PACKET", errors: ["packet:malformed_version"], packetVersion: null };
  if (value.version !== 1) return { status: "UNSUPPORTED_VERSION", errors: [`packet:unsupported_version:${value.version}`], packetVersion: value.version };
  const errors: string[] = [];
  if (!onlyKeys(value, ["version", "decisionId", "proposedAction", "evidenceAssessments", "policy", "actionDecision"])) errors.push("packet:unexpected_fields");
  if (typeof value.decisionId !== "string") errors.push("packet:invalid_decision_id");
  if (!validateAction(value.proposedAction)) errors.push("packet:invalid_proposed_action");
  if (!Array.isArray(value.evidenceAssessments) || !value.evidenceAssessments.every(validateAssessment)) errors.push("packet:invalid_evidence_assessments");
  if (!validatePolicy(value.policy)) errors.push("packet:invalid_policy");
  else if (validateAction(value.proposedAction) && canonicalSerialize(value.policy) !== canonicalSerialize(supplierPaymentPolicy(value.proposedAction))) errors.push("packet:policy_snapshot_inconsistent");
  if (!validateDecision(value.actionDecision)) errors.push("packet:invalid_action_decision");
  if (errors.length > 0) return { status: "INVALID_PACKET", errors: sorted(errors), packetVersion: 1 };
  return { packet: value as unknown as DecisionPacket, errors: [], packetVersion: 1 };
}

function normalizeDecision(value: ActionDecision): ActionDecision {
  return { decision: value.decision, reasons: sorted(value.reasons), satisfiedRequirements: sorted(value.satisfiedRequirements), unsatisfiedRequirements: sorted(value.unsatisfiedRequirements), blockingEvidence: sorted(value.blockingEvidence), reviewEvidence: sorted(value.reviewEvidence) };
}

function compareDecisions(recorded: ActionDecision, recomputed: ActionDecision): string[] {
  const left = normalizeDecision(recorded), right = normalizeDecision(recomputed), mismatches: string[] = [];
  for (const field of ["decision", "reasons", "satisfiedRequirements", "unsatisfiedRequirements", "blockingEvidence", "reviewEvidence"] as const) if (canonicalSerialize(left[field]) !== canonicalSerialize(right[field])) mismatches.push(`actionDecision.${field}`);
  return sorted(mismatches);
}

function event(order: number, type: ReplayEvent["type"], title: string, summary: string, details: Record<string, unknown>): ReplayEvent {
  return { order, type, title, summary, details: sanitizeReplayValue(details) as Record<string, unknown> };
}

function validTimeline(packet: DecisionPacket, recomputed: ActionDecision, validation: ReplayValidation): ReplayEvent[] {
  const gaps = packet.evidenceAssessments.flatMap((assessment) => [...assessment.contradictions.map((item) => `${assessment.intent}:contradiction:${item}`), ...assessment.missingEvidence.map((item) => `${assessment.intent}:missing:${item}`), ...(assessment.coverage === "OUT_OF_COVERAGE" ? [`${assessment.intent}:out_of_coverage`] : [])]).sort();
  return [
    event(1, "ACTION_PROPOSED", "Action proposed", packet.proposedAction.description, { type: packet.proposedAction.type, subject: packet.proposedAction.subject, riskClass: packet.proposedAction.riskClass }),
    event(2, "EVIDENCE_REQUIRED", "Evidence required", "Recorded policy requirements", { requirements: packet.policy.requirements }),
    event(3, "EVIDENCE_ASSESSED", "Evidence assessed", "Recorded evidence quality assessments", { assessments: packet.evidenceAssessments }),
    event(4, "CONTRADICTION_OR_GAP", "Contradictions and gaps", gaps.length === 0 ? "No recorded contradictions or required-evidence gaps" : "Recorded contradictions or evidence gaps require attention", { items: gaps }),
    event(5, "POLICY_EVALUATED", "Policy evaluated", "Canonical Action Policy reapplied to recorded inputs", { policyId: packet.policy.id, policyVersion: packet.policy.version, reasons: recomputed.reasons }),
    event(6, "DECISION_RECORDED", "Decision recorded", `Recorded decision: ${packet.actionDecision.decision}`, { actionDecision: packet.actionDecision }),
    event(7, "DECISION_RECOMPUTED", "Decision recomputed", `Recomputed decision: ${recomputed.decision}`, { actionDecision: recomputed }),
    event(8, validation.matches ? "REPLAY_VERIFIED" : "REPLAY_MISMATCH", validation.matches ? "Replay verified" : "Replay mismatch", validation.matches ? "Recorded and recomputed ActionDecision fields match" : "Recorded and recomputed ActionDecision fields differ", { matches: validation.matches, mismatches: validation.mismatches }),
  ];
}

export function replayDecisionPacket(input: unknown): DecisionReplay {
  const checked = validatePacket(input);
  if (!checked.packet) {
    const validation: ReplayValidation = { status: checked.status ?? "INVALID_PACKET", packetVersion: checked.packetVersion, recordedDecision: null, recomputedDecision: null, matches: false, mismatches: checked.errors, warnings: [] };
    const decisionId = isRecord(input) && typeof input.decisionId === "string" ? sanitizeReplayValue(input.decisionId, "decisionId") as string : null;
    return { version: 1, replayId: "unavailable", packetVersion: checked.packetVersion, decisionId, fingerprint: null, validation, proposedAction: null, evidence: [], policyEvaluation: null, recordedDecision: null, recomputedDecision: null, timeline: [event(1, "REPLAY_REJECTED", "Replay rejected", "Packet validation failed", { status: validation.status, mismatches: validation.mismatches })], postDecisionOutcome: "NOT_RECORDED" };
  }
  const packet = structuredClone(checked.packet);
  const recomputed = evaluateRecordedPolicy(packet.proposedAction, packet.evidenceAssessments, packet.policy);
  const mismatches = compareDecisions(packet.actionDecision, recomputed);
  const matches = mismatches.length === 0;
  const validation: ReplayValidation = { status: matches ? "VERIFIED" : "MISMATCH", packetVersion: 1, recordedDecision: packet.actionDecision.decision, recomputedDecision: recomputed.decision, matches, mismatches, warnings: [] };
  const fingerprint = fingerprintDecisionPacket(packet);
  return { version: 1, replayId: `sha256:${fingerprint}`, packetVersion: 1, decisionId: packet.decisionId, fingerprint, validation, proposedAction: sanitizeReplayValue(packet.proposedAction) as ProposedAction, evidence: sanitizeReplayValue(packet.evidenceAssessments) as EvidenceAssessment[], policyEvaluation: sanitizeReplayValue(packet.policy) as ActionPolicySnapshot, recordedDecision: sanitizeReplayValue(packet.actionDecision) as ActionDecision, recomputedDecision: sanitizeReplayValue(recomputed) as ActionDecision, timeline: validTimeline(packet, recomputed, validation), postDecisionOutcome: "NOT_RECORDED" };
}

export function serializeDecisionReplay(replay: DecisionReplay): string { return canonicalSerialize(replay); }
