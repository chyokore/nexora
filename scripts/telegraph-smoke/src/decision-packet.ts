import { evaluateActionPolicy, type ActionDecision, type ActionPolicySnapshot, type ProposedAction } from "./action-policy.js";
import type { EvidenceAssessment } from "./types.js";

export interface DecisionPacket {
  version: 1;
  decisionId: string;
  proposedAction: ProposedAction;
  evidenceAssessments: EvidenceAssessment[];
  policy: ActionPolicySnapshot;
  actionDecision: ActionDecision;
}

const clone = <T>(value: T): T => structuredClone(value);

function sortedAssessments(values: readonly EvidenceAssessment[]): EvidenceAssessment[] {
  return [...clone(values)].sort((a, b) => a.intent.localeCompare(b.intent) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export function createDecisionPacket(decisionId: string, proposedAction: ProposedAction, evidenceAssessments: readonly EvidenceAssessment[]): Readonly<DecisionPacket> {
  const assessments = sortedAssessments(evidenceAssessments);
  const { policy, actionDecision } = evaluateActionPolicy(proposedAction, assessments);
  return deepFreeze({ version: 1, decisionId, proposedAction: clone(proposedAction), evidenceAssessments: assessments, policy, actionDecision });
}

export function serializeDecisionPacket(packet: Readonly<DecisionPacket>): string {
  return JSON.stringify(packet);
}
