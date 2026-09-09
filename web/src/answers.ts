import type { InvestigationRunResult } from "./contracts";

export interface DirectAnswerResult {
  answer: "YES" | "NO" | "UNCERTAIN";
  explanation: string;
}

const BINARY_STARTERS = [
  "is",
  "are",
  "was",
  "were",
  "does",
  "do",
  "did",
  "has",
  "have",
  "had",
  "can",
  "could",
  "will",
  "would",
];

export function isBinaryQuestion(question: string): boolean {
  if (!question || typeof question !== "string") return false;
  const cleaned = question.trim().toLowerCase().replace(/^[^\w]+/, "");
  if (!cleaned) return false;
  const firstWord = cleaned.split(/\s+/)[0];
  return BINARY_STARTERS.includes(firstWord);
}

export function isNegativeQuestion(question: string): boolean {
  if (!question || typeof question !== "string") return false;
  const lower = question.trim().toLowerCase();
  const firstWord = lower.replace(/^[^\w]+/, "").split(/\s+/)[0];
  if (
    firstWord.endsWith("n't") ||
    firstWord === "cannot" ||
    firstWord === "never"
  ) {
    return true;
  }
  return /\b(not|no|none|never|n't|invalid)\b/i.test(lower);
}

export function deriveDirectAnswer(
  question: string,
  verdict: string,
  result?: InvestigationRunResult
): DirectAnswerResult | null {
  if (!isBinaryQuestion(question)) {
    return null;
  }

  const uppercaseVerdict = (verdict || "").toUpperCase();

  if (uppercaseVerdict === "INCONCLUSIVE") {
    return {
      answer: "UNCERTAIN",
      explanation:
        "Nexora does not have enough reliable evidence to answer yes or no yet.",
    };
  }

  const isNeg = isNegativeQuestion(question);

  const hasOnchainTxEvidence = Boolean(
    result?.investigationPlan?.txHashTarget ||
      result?.acquiredIntelligence?.some(
        (intel) => intel.intent === "ONCHAIN_TX_LOOKUP"
      ) ||
      result?.evidenceQuestions?.some(
        (eq) => eq.intent === "ONCHAIN_TX_LOOKUP"
      ) ||
      (result?.investigationPlan?.requirements &&
        result.investigationPlan.requirements.some(
          (req: any) => req.intent === "ONCHAIN_TX_LOOKUP"
        ))
  );

  if (uppercaseVerdict === "SUPPORTED") {
    if (!isNeg && hasOnchainTxEvidence) {
      return {
        answer: "YES",
        explanation:
          "The available evidence supports that the referenced transaction exists on the claimed network.",
      };
    }
    return {
      answer: "YES",
      explanation: "The available evidence supports this.",
    };
  }

  if (uppercaseVerdict === "DISPUTED") {
    if (!isNeg && hasOnchainTxEvidence) {
      return {
        answer: "NO",
        explanation:
          "The available evidence does not support that the referenced transaction exists on the claimed network.",
      };
    }
    return {
      answer: "NO",
      explanation: "The available evidence does not support this.",
    };
  }

  return {
    answer: "UNCERTAIN",
    explanation:
      "Nexora does not have enough reliable evidence to answer yes or no yet.",
  };
}
