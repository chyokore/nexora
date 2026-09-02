import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { scenarioById, type ScenarioId } from "./scenarios";

function apiResult(decision: "ALLOW" | "REVIEW" | "BLOCK", scenario: ScenarioId = "supported") {
  const actionDecision = { decision, reasons: [`decision:${decision.toLowerCase()}`], satisfiedRequirements: decision === "ALLOW" ? ["fraud-assessment", "supplier-url-assessment"] : [], unsatisfiedRequirements: decision === "REVIEW" ? ["fraud-assessment"] : [], blockingEvidence: decision === "BLOCK" ? ["FRAUD_DETECTION:STRONG"] : [], reviewEvidence: [] };
  const timeline = ["Action Proposed", "Evidence Required", "Evidence Assessed", "Contradictions and Gaps", "Policy Evaluated", "Decision Recorded", "Decision Recomputed", "Replay Verified"].map((title, index) => ({ order: index + 1, type: title.toUpperCase().split(" ").join("_"), title, summary: `Event ${index + 1}` }));
  return { decisionPacket: { version: 1, decisionId: "decision:test", proposedAction: {}, evidenceAssessments: scenarioById(scenario).evidence, actionDecision }, decisionReplay: { replayId: "sha256:test", decisionId: "decision:test", fingerprint: "abc123fingerprint", validation: { status: "VERIFIED", recordedDecision: decision, recomputedDecision: decision, matches: true, mismatches: [], warnings: [] }, evidence: [], recordedDecision: actionDecision, recomputedDecision: actionDecision, timeline, postDecisionOutcome: "NOT_RECORDED" } };
}

function mockApi(decision: "ALLOW" | "REVIEW" | "BLOCK", scenario: ScenarioId = "supported") {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => apiResult(decision, scenario) }));
}

async function evaluate() { fireEvent.click(screen.getByRole("button", { name: /Evaluate decision/ })); await waitFor(() => expect(screen.queryByText(/Evaluating with Product API/)).not.toBeInTheDocument()); }

describe("judge-facing experience", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("renders the homepage positioning", () => { render(<App />); expect(screen.getByRole("heading", { name: /Decision Layer.*Autonomous Agents/ })).toBeVisible(); });
  it("renders the supplier-payment form", () => { render(<App />); expect(screen.getByLabelText("Action ID")).toHaveValue("supplier-payment-001"); expect(screen.getByLabelText("Risk class")).toHaveValue("HIGH"); });
  it("calls the API rather than local policy logic", async () => { mockApi("ALLOW"); render(<App />); await evaluate(); expect(fetch).toHaveBeenCalledTimes(1); });
  it("renders API-provided ALLOW", async () => { mockApi("ALLOW"); render(<App />); await evaluate(); expect(screen.getByRole("heading", { name: "ALLOW" })).toBeVisible(); });
  it("renders coverage-gap REVIEW", async () => { mockApi("REVIEW", "coverage-gap"); render(<App />); fireEvent.click(screen.getByRole("radio", { name: /FRAUD COVERAGE GAP/ })); await evaluate(); expect(screen.getByRole("heading", { name: "REVIEW" })).toBeVisible(); });
  it("preserves confidence 100% and contradicted quality", async () => { mockApi("REVIEW", "contradicted"); render(<App />); fireEvent.click(screen.getByRole("radio", { name: /CONTRADICTED ONCHAIN/ })); await evaluate(); expect(screen.getByText("100%")).toBeVisible(); expect(screen.getAllByText("CONTRADICTED").length).toBeGreaterThan(1); });
  it("labels the BLOCK case as synthetic", async () => { mockApi("BLOCK", "adverse"); render(<App />); fireEvent.click(screen.getByRole("radio", { name: /VERIFIED ADVERSE/ })); await evaluate(); expect(screen.getAllByText(/SYNTHETIC POLICY TEST/).length).toBeGreaterThan(0); });
  it("opens Decision Replay", async () => { mockApi("ALLOW"); render(<App />); await evaluate(); fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ })); expect(screen.getByText(/Same inputs/)).toBeVisible(); });
  it("shows replay validation VERIFIED", async () => { mockApi("ALLOW"); render(<App />); await evaluate(); expect(screen.getByRole("button", { name: /VERIFIED/ })).toBeVisible(); });
  it("shows the packet fingerprint", async () => { mockApi("ALLOW"); render(<App />); await evaluate(); fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ })); expect(screen.getByText("abc123fingerprint")).toBeVisible(); });
  it("shows recorded and recomputed decisions", async () => { mockApi("ALLOW"); render(<App />); await evaluate(); fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ })); expect(screen.getByText("ALLOW / ALLOW")).toBeVisible(); });
  it("renders timeline in API order", async () => { mockApi("ALLOW"); render(<App />); await evaluate(); fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ })); const items = screen.getAllByRole("listitem"); expect(items[0]).toHaveTextContent("Action Proposed"); expect(items[7]).toHaveTextContent("Replay Verified"); });
  it("displays NOT_RECORDED faithfully", async () => { mockApi("ALLOW"); render(<App />); await evaluate(); fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ })); expect(screen.getByText("NOT_RECORDED")).toBeVisible(); });
  it("shows API failure and no fallback", async () => { vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable"))); render(<App />); await evaluate(); expect(screen.getByText("Product API unavailable")).toBeVisible(); expect(screen.queryByRole("heading", { name: /ALLOW|REVIEW|BLOCK/ })).not.toBeInTheDocument(); });
  it("handles malformed API response safely", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })); render(<App />); await evaluate(); expect(screen.getByText(/malformed response/)).toBeVisible(); });
  it("contains no private-key or wallet UI", () => { render(<App />); expect(screen.queryByText(/private key|wallet/i)).not.toBeInTheDocument(); });
  it("contains no transaction execution button", () => { render(<App />); expect(screen.queryByRole("button", { name: /execute|pay|sign|transact/i })).not.toBeInTheDocument(); });
  it("distinguishes provider confidence from Nexora quality", async () => { mockApi("ALLOW"); render(<App />); await evaluate(); expect(screen.getAllByText("Provider confidence").length).toBeGreaterThan(0); expect(screen.getAllByText("Nexora quality").length).toBeGreaterThan(0); });
});
