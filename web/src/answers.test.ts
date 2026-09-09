import { describe, expect, it } from "vitest";
import { deriveDirectAnswer, isBinaryQuestion, isNegativeQuestion } from "./answers";

describe("binary question detection", () => {
  it("detects common binary starter words", () => {
    expect(isBinaryQuestion("Is this transaction valid on chain?")).toBe(true);
    expect(isBinaryQuestion("Does this transaction exist on Base Sepolia?")).toBe(true);
    expect(isBinaryQuestion("Can this supplier URL be trusted?")).toBe(true);
    expect(isBinaryQuestion("Are there fraud indicators?")).toBe(true);
    expect(isBinaryQuestion("Has this transaction been included?")).toBe(true);
  });

  it("identifies non-binary questions", () => {
    expect(isBinaryQuestion("What happened in this transaction?")).toBe(false);
    expect(isBinaryQuestion("Who owns this address?")).toBe(false);
    expect(isBinaryQuestion("Where is the contract deployed?")).toBe(false);
    expect(isBinaryQuestion("How many confirmations does it have?")).toBe(false);
  });

  it("detects negatively phrased binary questions", () => {
    expect(isNegativeQuestion("Does this transaction not exist?")).toBe(true);
    expect(isNegativeQuestion("Is this transaction invalid?")).toBe(true);
    expect(isNegativeQuestion("Isn't this transaction included?")).toBe(true);
    expect(isNegativeQuestion("Is this transaction valid on chain?")).toBe(false);
  });
});

describe("direct answer derivation", () => {
  const mockOnchainResult: any = {
    investigationPlan: { txHashTarget: "0xcd9a..." },
    acquiredIntelligence: [{ intent: "ONCHAIN_TX_LOOKUP" }],
  };

  it("1. returns YES for binary question with SUPPORTED verdict", () => {
    const res = deriveDirectAnswer("Is this transaction valid on chain?", "SUPPORTED", mockOnchainResult);
    expect(res).toEqual({
      answer: "YES",
      explanation: "The available evidence supports that the referenced transaction exists on the claimed network.",
    });
  });

  it("2. returns UNCERTAIN for binary question with INCONCLUSIVE verdict", () => {
    const res = deriveDirectAnswer("Is this transaction valid on chain?", "INCONCLUSIVE", mockOnchainResult);
    expect(res).toEqual({
      answer: "UNCERTAIN",
      explanation: "Nexora does not have enough reliable evidence to answer yes or no yet.",
    });
  });

  it("3. returns NO for binary question with DISPUTED verdict", () => {
    const res = deriveDirectAnswer("Is this transaction valid on chain?", "DISPUTED", mockOnchainResult);
    expect(res).toEqual({
      answer: "NO",
      explanation: "The available evidence does not support that the referenced transaction exists on the claimed network.",
    });
  });

  it("4. returns null for non-binary question 'What happened in this transaction?'", () => {
    const res = deriveDirectAnswer("What happened in this transaction?", "SUPPORTED", mockOnchainResult);
    expect(res).toBeNull();
  });

  it("5. returns null for non-binary question 'Who owns this address?'", () => {
    const res = deriveDirectAnswer("Who owns this address?", "SUPPORTED", mockOnchainResult);
    expect(res).toBeNull();
  });

  it("7. uses conservative wording for negatively phrased binary questions", () => {
    const res = deriveDirectAnswer("Does this transaction not exist?", "SUPPORTED", mockOnchainResult);
    expect(res).toEqual({
      answer: "YES",
      explanation: "The available evidence supports this.",
    });
  });
});
