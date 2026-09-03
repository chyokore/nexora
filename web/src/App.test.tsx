import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { scenarioById, type ScenarioId } from "./scenarios";

function apiResult(decision: "ALLOW" | "REVIEW" | "BLOCK", scenario: ScenarioId = "supported") {
  const actionDecision = {
    decision,
    reasons: [`decision:${decision.toLowerCase()}`],
    satisfiedRequirements: decision === "ALLOW" ? ["fraud-assessment", "supplier-url-assessment"] : [],
    unsatisfiedRequirements: decision === "REVIEW" ? ["fraud-assessment"] : [],
    blockingEvidence: decision === "BLOCK" ? ["FRAUD_DETECTION:STRONG"] : [],
    reviewEvidence: [],
  };
  const timeline = [
    "Action Proposed",
    "Evidence Required",
    "Evidence Assessed",
    "Contradictions and Gaps",
    "Policy Evaluated",
    "Decision Recorded",
    "Decision Recomputed",
    "Replay Verified",
  ].map((title, index) => ({
    order: index + 1,
    type: title.toUpperCase().split(" ").join("_"),
    title,
    summary: `Event ${index + 1}`,
  }));

  return {
    decisionPacket: {
      version: 1,
      decisionId: "decision:test",
      proposedAction: {},
      evidenceAssessments: scenarioById(scenario).evidence,
      actionDecision,
    },
    decisionReplay: {
      replayId: "sha256:test",
      decisionId: "decision:test",
      fingerprint: "abc123fingerprint",
      validation: {
        status: "VERIFIED",
        recordedDecision: decision,
        recomputedDecision: decision,
        matches: true,
        mismatches: [],
        warnings: [],
      },
      evidence: [],
      recordedDecision: actionDecision,
      recomputedDecision: actionDecision,
      timeline,
      postDecisionOutcome: "NOT_RECORDED",
    },
  };
}

const mockDiscovery = {
  status: "ok",
  service: "nexora-api",
  discoveryType: "FREE_REGISTRY_INSPECTION",
  timestamp: "2026-09-03T11:00:00.000Z",
  totalRegistrations: 129,
  discovery: {
    FRAUD_DETECTION: {
      eligibleCount: 6,
      winner: {
        id: "10002",
        name: "DegenLens",
        rank: 1,
        score: 1.0,
        method: "GET",
        endpoint: "/anomaly/check",
        schemaFamily: "query-only",
        advertisedPriceMicroUsdc: 10000,
      },
    },
    URL_SCAN: {
      eligibleCount: 7,
      winner: {
        id: "7334",
        name: "NetWire",
        rank: 1,
        score: 0.95,
        method: "GET",
        endpoint: "/url-scan",
        schemaFamily: "declared-url",
        advertisedPriceMicroUsdc: 10000,
      },
    },
    ONCHAIN_TX_LOOKUP: {
      eligibleCount: 8,
      winner: {
        id: "9002",
        name: "TxLens",
        rank: 1,
        score: 0.01,
        method: "GET",
        endpoint: "/check-tx",
        schemaFamily: "transaction-identifier",
        advertisedPriceMicroUsdc: 10000,
      },
    },
  },
};

function mockApi(decision: "ALLOW" | "REVIEW" | "BLOCK", scenario: ScenarioId = "supported") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/v1/discovery")) {
        return { ok: true, json: async () => mockDiscovery };
      }
      return { ok: true, json: async () => apiResult(decision, scenario) };
    })
  );
}

async function evaluate() {
  fireEvent.click(screen.getByRole("button", { name: /Evaluate Action Decision/ }));
  await waitFor(() => expect(screen.queryByText(/Evaluating with/)).not.toBeInTheDocument());
}

describe("judge-facing experience", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the homepage positioning and core message", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByRole("heading", { name: /Verify Intelligence.*Bound Action/ })).toBeVisible();
    expect(screen.getByText(/Intelligence tells an agent what is happening/)).toBeVisible();
  });

  it("renders the Live Decision section and Run Live Decision button", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByRole("heading", { name: /See an agent ask Nexora whether it should proceed/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Run Live Decision/ })).toBeVisible();
  });

  it("renders architecture snapshot and contradiction spotlight", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByRole("heading", { name: /How Nexora Evaluates Agent Actions/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /The Contradiction Case/ })).toBeVisible();
    expect(screen.getByText(/High Confidence ≠ Correct Evidence/)).toBeVisible();
  });

  it("renders live discovery inspector data when connected", async () => {
    mockApi("ALLOW");
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/129 Miners/)).toBeVisible();
      expect(screen.getByText("DegenLens")).toBeVisible();
    });
  });

  it("renders the supplier-payment form", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByLabelText("Action ID")).toHaveValue("supplier-payment-001");
    expect(screen.getByLabelText("Risk Class")).toHaveValue("HIGH");
  });

  it("calls the API rather than local policy logic", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    expect(fetch).toHaveBeenCalled();
  });

  it("renders API-provided ALLOW", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    expect(screen.getByRole("heading", { name: "ALLOW" })).toBeVisible();
  });

  it("renders coverage-gap REVIEW", async () => {
    mockApi("REVIEW", "coverage-gap");
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: /FRAUD COVERAGE GAP/ }));
    await evaluate();
    expect(screen.getByRole("heading", { name: "REVIEW" })).toBeVisible();
  });

  it("preserves confidence 100% and contradicted quality", async () => {
    mockApi("REVIEW", "contradicted");
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: /CONTRADICTED ONCHAIN/ }));
    await evaluate();
    expect(screen.getByText("100%")).toBeVisible();
    expect(screen.getAllByText("CONTRADICTED").length).toBeGreaterThan(1);
  });

  it("labels the BLOCK case as synthetic", async () => {
    mockApi("BLOCK", "adverse");
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: /VERIFIED ADVERSE/ }));
    await evaluate();
    expect(screen.getAllByText(/SYNTHETIC POLICY TEST/).length).toBeGreaterThan(0);
  });

  it("opens Decision Replay and displays SHA-256 fingerprint", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ }));
    expect(screen.getByText(/Deterministic Integrity Verified/)).toBeVisible();
    expect(screen.getByText("abc123fingerprint")).toBeVisible();
  });

  it("shows replay validation VERIFIED", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    expect(screen.getByRole("button", { name: /VERIFIED/ })).toBeVisible();
  });

  it("shows recorded and recomputed decisions", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ }));
    expect(screen.getByText("ALLOW / ALLOW")).toBeVisible();
  });

  it("renders timeline in API order", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ }));
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Action Proposed");
    expect(items[7]).toHaveTextContent("Replay Verified");
  });

  it("displays NOT_RECORDED faithfully", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ }));
    expect(screen.getByText("NOT_RECORDED")).toBeVisible();
  });

  it("shows API failure and no fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes("/v1/discovery")) return { ok: true, json: async () => mockDiscovery };
        return { ok: false, status: 500, json: async () => ({ error: { message: "unavailable" } }) };
      })
    );
    render(<App />);
    await evaluate();
    expect(screen.getByText("Product API unavailable")).toBeVisible();
    expect(screen.queryByRole("heading", { name: /^(ALLOW|REVIEW|BLOCK)$/, level: 2 })).not.toBeInTheDocument();
  });

  it("contains no private-key or wallet UI", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.queryByText(/private key|seed phrase/i)).not.toBeInTheDocument();
  });

  it("contains no transaction execution button", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.queryByRole("button", { name: /execute|pay|sign|transact/i })).not.toBeInTheDocument();
  });

  it("distinguishes provider confidence from Nexora quality", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    expect(screen.getAllByText("Provider Confidence").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nexora Quality").length).toBeGreaterThan(0);
  });

  it("renders sample decision questions section", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByRole("heading", { name: "WHAT CAN NEXORA HELP DECIDE?", level: 2 })).toBeInTheDocument();
    expect(screen.getByText('"Should this supplier payment be authorized?"')).toBeInTheDocument();
    expect(screen.getByText('"Is the available fraud evidence strong enough to proceed?"')).toBeInTheDocument();
    expect(screen.getByText('"Does the supplier destination meet the evidence requirements for this action?"')).toBeInTheDocument();
    expect(screen.getByText('"Why did Nexora hold this action for review?"')).toBeInTheDocument();
  });

  it("renders why Nexora is different section with three principles", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByRole("heading", { name: "WHY NEXORA IS DIFFERENT", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "INTELLIGENCE IS NOT A DECISION", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "EVIDENCE KEEPS ITS OWN QUALITY", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "THE AGENT MUST OBEY THE RESULT", level: 3 })).toBeInTheDocument();
  });

  it("renders FAQ section with accessible questions and review safety banner", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Frequently Asked Questions", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("REVIEW IS A SAFETY DECISION")).toBeInTheDocument();
    expect(screen.getByText("What does Nexora do?")).toBeInTheDocument();
    expect(screen.getByText("How does Telegraph fit into Nexora?")).toBeInTheDocument();
    expect(screen.getByText("Why can Nexora return REVIEW after paying for intelligence?")).toBeInTheDocument();
    expect(screen.getByText("Does Nexora move money?")).toBeInTheDocument();
    expect(screen.getByText("Can I see why Nexora made a decision?")).toBeInTheDocument();
    expect(screen.getByText("What happens when miners disagree or evidence is incomplete?")).toBeInTheDocument();
  });

  it("renders Decision Replay trail explanation", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    expect(screen.getAllByText("EVERY DECISION LEAVES A TRAIL").length).toBeGreaterThan(0);
  });
});

