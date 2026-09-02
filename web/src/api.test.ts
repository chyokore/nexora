import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateDecision } from "./api";
import { scenarioById } from "./scenarios";
import type { ProposedAction } from "./contracts";

const action: ProposedAction = { id: "test", type: "SUPPLIER_PAYMENT_AUTHORIZATION", description: "Test", subject: { kind: "SUPPLIER_PAYMENT", reference: "supplier" }, riskClass: "HIGH" };
const response = { decisionPacket: { version: 1, decisionId: "decision:test", proposedAction: action, evidenceAssessments: [], actionDecision: { decision: "ALLOW", reasons: [], satisfiedRequirements: [], unsatisfiedRequirements: [], blockingEvidence: [], reviewEvidence: [] } }, decisionReplay: { validation: { matches: true }, timeline: [], fingerprint: "test" } };

describe("Product API client", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it("posts proposed action and evidence to the Product API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);
    await evaluateDecision(action, scenarioById("supported").evidence);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/decisions/evaluate", expect.objectContaining({ method: "POST" }));
  });
  it("surfaces Product API errors without a fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: { message: "offline" } }) }));
    await expect(evaluateDecision(action, [])).rejects.toThrow("offline");
  });
  it("rejects a malformed successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ decisionPacket: {}, decisionReplay: {} }) }));
    await expect(evaluateDecision(action, [])).rejects.toThrow("malformed response");
  });
});
