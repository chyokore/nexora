import type { DiscoveryResponse, EvaluationResponse, EvidenceAssessment, InvestigationInput, InvestigationRunResult, LiveDecisionRunResult, ProposedAction } from "./contracts";

const apiBase = (import.meta.env.VITE_NEXORA_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

export async function evaluateDecision(proposedAction: ProposedAction, evidenceAssessments: EvidenceAssessment[]): Promise<EvaluationResponse> {
  const response = await fetch(`${apiBase}/v1/decisions/evaluate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposedAction, evidenceAssessments }) });
  const body = await response.json().catch(() => null) as EvaluationResponse | { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body && "error" in body ? body.error?.message ?? `API request failed (${response.status})` : `API request failed (${response.status})`);
  if (!body || !("decisionPacket" in body) || !("decisionReplay" in body) || !body.decisionPacket.actionDecision?.decision || !Array.isArray(body.decisionPacket.evidenceAssessments) || !body.decisionReplay.validation || typeof body.decisionReplay.validation.matches !== "boolean" || !Array.isArray(body.decisionReplay.timeline) || typeof body.decisionReplay.fingerprint !== "string") throw new Error("The Product API returned a malformed response");
  return body;
}

export async function fetchDiscovery(): Promise<DiscoveryResponse> {
  const response = await fetch(`${apiBase}/v1/discovery`);
  const body = await response.json().catch(() => null) as DiscoveryResponse | { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body && "error" in body && body.error?.message ? body.error.message : `Discovery request failed (${response.status})`);
  if (!body || !("totalRegistrations" in body) || typeof body.totalRegistrations !== "number" || !("discovery" in body)) throw new Error("The Discovery API returned a malformed response");
  return body as DiscoveryResponse;
}

export async function runLiveDecision(proposedAction: ProposedAction): Promise<LiveDecisionRunResult> {
  const response = await fetch(`${apiBase}/v1/agent/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ proposedAction }),
  });
  const body = await response.json().catch(() => null) as LiveDecisionRunResult | { error?: { code?: string; message?: string; details?: string[] } } | null;
  if (!response.ok) {
    if (body && "error" in body) {
      const err = body.error;
      if (err?.code === "LIVE_AGENT_DISABLED") throw new Error("Live decisions are currently disabled on this deployment.");
      if (err?.code === "RATE_LIMITED") throw new Error(`Live decision rate limit reached. ${err.details?.[0] ?? "Please wait before trying again."}`);
      if (err?.code === "ENVIRONMENT_NOT_CONFIGURED") throw new Error("Live decisions are not configured on this deployment.");
      throw new Error(err?.message ?? `Live decision request failed (${response.status})`);
    }
    throw new Error(`Live decision request failed (${response.status})`);
  }
  if (!body || !("runId" in body) || !("agentState" in body) || !("actionDecision" in body)) {
    throw new Error("The Live Decision API returned a malformed response");
  }
  return body as LiveDecisionRunResult;
}

export async function runInvestigation(input: InvestigationInput): Promise<InvestigationRunResult> {
  const response = await fetch(`${apiBase}/v1/investigations/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null) as InvestigationRunResult | { error?: { code?: string; message?: string; details?: string[] } } | null;
  if (!response.ok) {
    if (body && "error" in body) {
      const err = body.error;
      if (err?.code === "LIVE_AGENT_DISABLED") throw new Error("Live investigations are currently disabled on this deployment.");
      if (err?.code === "RATE_LIMITED") throw new Error(`Rate limit reached. ${err.details?.[0] ?? "Please wait before trying again."}`);
      if (err?.code === "ENVIRONMENT_NOT_CONFIGURED") throw new Error("Live investigations are not configured on this deployment.");
      throw new Error(err?.message ?? `Investigation request failed (${response.status})`);
    }
    throw new Error(`Investigation request failed (${response.status})`);
  }
  if (!body || !("runId" in body) || !("verdict" in body)) {
    throw new Error("The Investigation API returned a malformed response");
  }
  return body as InvestigationRunResult;
}
