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

  const acquiredIntelligence = [
    {
      intent: "FRAUD_DETECTION",
      minerId: "10002",
      minerName: "DegenLens",
      rank: 1,
      method: "GET",
      endpoint: "/anomaly/check",
      advertisedPriceMicroUsdc: 10000,
      logicalCallId: "call-1",
      outcome: { status: "acquired" },
    },
  ];

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
    // Top-level LiveDecisionRunResult properties
    runId: "run:test-12345",
    timestamp: "2026-09-04T10:00:00.000Z",
    userQuestion: "Is there enough reliable evidence for my agent to authorize this supplier payment?",
    proposedAction: {
      id: "supplier-payment-001",
      type: "SUPPLIER_PAYMENT_AUTHORIZATION",
      description: "Authorize payment to updated supplier destination",
      subject: {
        kind: "SUPPLIER_PAYMENT",
        reference: "supplier-northstar-042",
        supplierUrl: "https://example.com/",
      },
      riskClass: "HIGH",
    },
    requirementPlan: {
      planId: "plan:test-12345",
      userQuestion: "Is there enough reliable evidence for my agent to authorize this supplier payment?",
      requirements: [],
    },
    evidenceQuestions: [],
    acquiredIntelligence,
    evidenceAssessments: scenarioById(scenario).evidence,
    actionDecision,
    agentState: decision === "ALLOW" ? "AUTHORIZED" : decision === "REVIEW" ? "HELD_FOR_REVIEW" : "REJECTED",
    agentStateLabel: decision === "ALLOW" ? "AUTHORIZED" : decision === "REVIEW" ? "HELD FOR REVIEW" : "REJECTED",
    agentStateSupport: "Agent state based on policy decision.",
    resolution: {
      resolved: decision === "ALLOW",
      unresolvedConditions: decision === "REVIEW" ? [{ requiredCondition: "fraud-assessment", description: "Fraud assessment incomplete" }] : [],
    },
    settlementProvenance: [],
    totalSettledMicroUsdc: 0,
    paidCallCount: 0,
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
  const authTab = screen.queryByRole("tab", { name: /AUTHORIZE ACTION/ });
  if (authTab) fireEvent.click(authTab);
  fireEvent.click(screen.getByRole("button", { name: /Run Authorization Check/ }));
  await waitFor(() => expect(screen.queryByText(/Acquiring intelligence/)).not.toBeInTheDocument());
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
    expect(screen.getByText(/Bring Nexora a question, claim, link, or onchain reference/)).toBeVisible();
  });

  it("renders the Decision Workspace section and mode tabs", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByRole("heading", { name: /INVESTIGATE WITH NEXORA/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: /INVESTIGATE/ })).toBeVisible();
    expect(screen.getByRole("tab", { name: /AUTHORIZE ACTION/ })).toBeVisible();
  });

  it("renders architecture snapshot and contradiction spotlight", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByRole("heading", { name: /How Nexora Turns Questions into Bounded Decisions/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /The Contradiction Case/ })).toBeVisible();
    expect(screen.getByText(/High Confidence ≠ Correct Evidence/)).toBeVisible();
  });

  it("renders live discovery inspector data when connected", async () => {
    mockApi("ALLOW");
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("129")).toBeVisible();
      expect(screen.getByText("Miners Registered")).toBeVisible();
      expect(screen.getByText("DegenLens")).toBeVisible();
    });
  });

  it("renders the supplier-payment form in Authorize Action mode", () => {
    mockApi("ALLOW");
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /AUTHORIZE ACTION/ }));
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
    await evaluate();
    expect(screen.getByRole("heading", { name: "REVIEW" })).toBeVisible();
  });

  it("preserves confidence 100% and contradicted quality", async () => {
    mockApi("REVIEW", "contradicted");
    render(<App />);
    await evaluate();
    expect(screen.getAllByText("CONTRADICTED").length).toBeGreaterThan(0);
  });

  it("labels the BLOCK case correctly", async () => {
    mockApi("BLOCK", "adverse");
    render(<App />);
    await evaluate();
    expect(screen.getByRole("heading", { name: "BLOCK" })).toBeVisible();
    expect(screen.getByText(/Authorization blocked/)).toBeVisible();
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

  it("displays decision replay metadata faithfully", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    fireEvent.click(screen.getByRole("button", { name: /View Decision Replay/ }));
    expect(screen.getByText("abc123fingerprint")).toBeVisible();
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
    expect(screen.getByText("Live decision unavailable")).toBeVisible();
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
    expect(screen.queryByRole("button", { name: /^execute$|^pay$|^sign$/i })).not.toBeInTheDocument();
  });

  it("distinguishes provider metadata from evidence quality", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    expect(screen.getAllByText("Provider").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Coverage").length).toBeGreaterThan(0);
  });

  it("renders sample questions section for judge clarity", () => {
    mockApi("ALLOW");
    render(<App />);
    expect(screen.getByRole("heading", { name: "WHAT CAN NEXORA HELP DECIDE?", level: 2 })).toBeInTheDocument();
    expect(screen.getByText('"Is this URL safe enough to trust?"')).toBeInTheDocument();
    expect(screen.getByText('"Does my agent have enough evidence to authorize this action?"')).toBeInTheDocument();
  });

  it("renders why nexora is different section with core principles", () => {
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
    expect(screen.getByText("What is Nexora?")).toBeInTheDocument();
    expect(screen.getByText("Is Nexora a chatbot or search engine?")).toBeInTheDocument();
    expect(screen.getByText("Why does Nexora ask several evidence questions?")).toBeInTheDocument();
    expect(screen.getByText("How does Nexora choose Telegraph miners?")).toBeInTheDocument();
    expect(screen.getByText("Does Nexora search the entire Telegraph network?")).toBeInTheDocument();
    expect(screen.getByText("Can one question use multiple miners?")).toBeInTheDocument();
    expect(screen.getByText("Why can’t Nexora simply trust a miner’s confidence score?")).toBeInTheDocument();
    expect(screen.getByText("Can a highly confident miner still be wrong?")).toBeInTheDocument();
    expect(screen.getByText("What are ALLOW, REVIEW, and BLOCK?")).toBeInTheDocument();
    expect(screen.getByText("What is Decision Replay?")).toBeInTheDocument();
    expect(screen.getByText("Does Nexora move money or execute a user’s transaction?")).toBeInTheDocument();
    expect(screen.getByText("Why does Nexora use Telegraph?")).toBeInTheDocument();
    expect(screen.getByText("Can Nexora work with links, images, documents, or videos?")).toBeInTheDocument();
  });

  it("renders Decision Replay trail explanation", async () => {
    mockApi("ALLOW");
    render(<App />);
    await evaluate();
    expect(screen.getAllByText("EVERY DECISION LEAVES A TRAIL").length).toBeGreaterThan(0);
  });

  it("populates form fields when example buttons are clicked", () => {
    mockApi("ALLOW");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Check a URL" }));
    expect(screen.getByLabelText(/Your Question/i)).toHaveValue("Is this supplier URL safe to proceed with?");
    expect(document.getElementById("inv-url")).toHaveValue("https://example.com/");
  });

  it("switches between INVESTIGATE and AUTHORIZE ACTION mode tabs", () => {
    mockApi("ALLOW");
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /AUTHORIZE ACTION/ }));
    expect(screen.getByRole("button", { name: /Run Authorization Check/ })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: /INVESTIGATE/ }));
    expect(screen.getByRole("button", { name: /Analyze with Nexora/ })).toBeVisible();
  });
});
