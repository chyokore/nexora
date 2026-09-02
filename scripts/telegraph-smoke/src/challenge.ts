import type { PaymentChallenge } from "./types.js";

function decodeHeader(value: string): unknown {
  try { return JSON.parse(Buffer.from(value, "base64").toString("utf8")); } catch { return undefined; }
}

export function parseChallenge(value: unknown): PaymentChallenge {
  const decoded = typeof value === "string" ? decodeHeader(value) : value;
  if (!decoded || typeof decoded !== "object") throw new Error("Malformed payment challenge");
  const root = decoded as Record<string, unknown>;
  const candidate = (Array.isArray(root.accepts) ? root.accepts[0] : root) as Record<string, unknown> | undefined;
  if (!candidate || typeof candidate !== "object") throw new Error("Malformed payment challenge");
  const extra = candidate.extra && typeof candidate.extra === "object" ? candidate.extra as Record<string, unknown> : {};
  const amount = candidate.amount ?? candidate.maxAmountRequired;
  const payTo = candidate.payTo;
  if (typeof candidate.scheme !== "string" || typeof candidate.network !== "string" || typeof candidate.asset !== "string" || (typeof amount !== "string" && typeof amount !== "number") || typeof payTo !== "string") {
    throw new Error("Malformed payment challenge");
  }
  const result: PaymentChallenge = { scheme: candidate.scheme, network: candidate.network, asset: candidate.asset, amount, payTo };
  const validUntil = candidate.validUntil ?? extra.validUntil;
  if (typeof validUntil === "string" || typeof validUntil === "number") result.validUntil = validUntil;
  if (typeof root.x402Version === "number") result.x402Version = root.x402Version;
  return result;
}

export function publicChallengeMetadata(challenge: PaymentChallenge): Record<string, unknown> {
  return { scheme: challenge.scheme, network: challenge.network, asset: challenge.asset, amount: challenge.amount, payTo: challenge.payTo, validUntil: challenge.validUntil, x402Version: challenge.x402Version };
}
