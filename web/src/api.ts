import type { EvaluationResponse, EvidenceAssessment, ProposedAction } from "./contracts";

const apiBase = (import.meta.env.VITE_NEXORA_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

export async function evaluateDecision(proposedAction: ProposedAction, evidenceAssessments: EvidenceAssessment[]): Promise<EvaluationResponse> {
  const response = await fetch(`${apiBase}/v1/decisions/evaluate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposedAction, evidenceAssessments }) });
  const body = await response.json().catch(() => null) as EvaluationResponse | { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body && "error" in body ? body.error?.message ?? `API request failed (${response.status})` : `API request failed (${response.status})`);
  if (!body || !("decisionPacket" in body) || !("decisionReplay" in body) || !body.decisionPacket.actionDecision?.decision || !Array.isArray(body.decisionPacket.evidenceAssessments) || !body.decisionReplay.validation || typeof body.decisionReplay.validation.matches !== "boolean" || !Array.isArray(body.decisionReplay.timeline) || typeof body.decisionReplay.fingerprint !== "string") throw new Error("The Product API returned a malformed response");
  return body;
}
