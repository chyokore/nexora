import { INTENTS, type Intent, type PaymentChallenge, type Selection } from "./types.js";

export const PAYMENT_POLICY = Object.freeze({
  network: "eip155:84532",
  scheme: "exact",
  maxLogicalCalls: 3,
  maxPerCallMicroUsdc: 10_000,
  maxCumulativeMicroUsdc: 30_000,
});

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export class RunLedger {
  readonly #used = new Set<string>();
  #cumulative: number;

  constructor(initialCumulative = 0) {
    if (!Number.isSafeInteger(initialCumulative) || initialCumulative < 0 || initialCumulative > PAYMENT_POLICY.maxCumulativeMicroUsdc) throw new Error("Invalid initial cumulative amount");
    this.#cumulative = initialCumulative;
  }

  authorize(logicalTestId: string, intent: Intent, selection: Selection, challenge: PaymentChallenge, approvedAsset?: string): number {
    if (!Object.values({ FRAUD_DETECTION: "fraud-smoke-001", URL_SCAN: "url-smoke-001", ONCHAIN_TX_LOOKUP: "onchain-smoke-001" }).includes(logicalTestId)) throw new Error("Unknown logical test ID");
    if (this.#used.has(logicalTestId)) throw new Error("Duplicate logical test ID");
    if (!INTENTS.includes(intent)) throw new Error("Unexpected intent");
    if (!selection.miner.supported_intents.includes(intent)) throw new Error("Unexpected selected miner");
    validateChallenge(challenge, approvedAsset);
    const amount = parseAmount(challenge.amount);
    if (this.#used.size + 1 > PAYMENT_POLICY.maxLogicalCalls) throw new Error("Logical call limit exceeded");
    if (this.#cumulative + amount > PAYMENT_POLICY.maxCumulativeMicroUsdc) throw new Error("Cumulative payment budget exceeded");
    this.#used.add(logicalTestId);
    this.#cumulative += amount;
    return this.#cumulative;
  }
}

export function parseAmount(value: string | number): number {
  let normalized: number;
  if (typeof value === "number") normalized = value;
  else if (/^\d+$/.test(value)) normalized = Number(value);
  else throw new Error("Malformed challenge amount");
  if (!Number.isSafeInteger(normalized) || normalized <= 0) throw new Error("Malformed challenge amount");
  return normalized;
}

export function validateChallenge(challenge: PaymentChallenge, approvedAsset?: string, now = Date.now()): void {
  if (!challenge || typeof challenge !== "object") throw new Error("Malformed payment challenge");
  if (challenge.scheme !== PAYMENT_POLICY.scheme) throw new Error("Unsupported payment scheme");
  if (challenge.network !== PAYMENT_POLICY.network) throw new Error("Wrong payment network");
  if (!EVM_ADDRESS.test(challenge.asset ?? "")) throw new Error("Malformed asset identifier");
  if (!approvedAsset) throw new Error("Asset approval required before signing");
  if (!EVM_ADDRESS.test(approvedAsset) || challenge.asset.toLowerCase() !== approvedAsset.toLowerCase()) throw new Error("Unsupported payment asset");
  if (!EVM_ADDRESS.test(challenge.payTo ?? "")) throw new Error("Missing or malformed payee");
  if (parseAmount(challenge.amount) > PAYMENT_POLICY.maxPerCallMicroUsdc) throw new Error("Per-call payment budget exceeded");
  if (challenge.validUntil !== undefined) {
    const raw = typeof challenge.validUntil === "string" && /^\d+$/.test(challenge.validUntil) ? Number(challenge.validUntil) : challenge.validUntil;
    const expiryMs = typeof raw === "number" && raw < 10_000_000_000 ? raw * 1000 : Number(raw);
    if (!Number.isFinite(expiryMs) || expiryMs <= now) throw new Error("Expired or malformed challenge");
  }
}
