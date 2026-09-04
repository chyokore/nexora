import type { PaymentChallenge } from "./types.js";

/**
 * Decode a payment challenge header value.
 *
 * Telegraph nodes may encode the challenge in one of two ways:
 *   1. Plain JSON string    (observed in production x402 v1 nodes)
 *   2. Base64-encoded JSON  (original x402 spec)
 *
 * We try plain JSON first (cheaper, more reliable), then base64 fallback.
 * If both fail we return undefined so the caller can produce a clean error.
 */
function decodeHeader(value: string): unknown {
  // Attempt 1: plain JSON (catches nodes that send JSON directly in the header)
  try { return JSON.parse(value); } catch { /* fall through */ }
  // Attempt 2: base64-encoded JSON (original x402 spec)
  try { return JSON.parse(Buffer.from(value, "base64").toString("utf8")); } catch { return undefined; }
}

export function parseChallenge(value: unknown): PaymentChallenge {
  const decoded = typeof value === "string" ? decodeHeader(value) : value;
  if (!decoded || typeof decoded !== "object") throw new Error("Malformed payment challenge: could not decode header as JSON or base64-JSON");
  const root = decoded as Record<string, unknown>;
  const candidate = (Array.isArray(root.accepts) ? root.accepts[0] : root) as Record<string, unknown> | undefined;
  if (!candidate || typeof candidate !== "object") throw new Error("Malformed payment challenge: no candidate object found (expected root or root.accepts[0])");
  const extra = candidate.extra && typeof candidate.extra === "object" ? candidate.extra as Record<string, unknown> : {};
  const amount = candidate.amount ?? candidate.maxAmountRequired;
  // Tolerate alternate spellings: payTo / pay_to / payto
  const payTo = candidate.payTo ?? candidate.pay_to ?? candidate.payto;
  // Per-field diagnostics so production failures are identifiable in logs
  const missing: string[] = [];
  if (typeof candidate.scheme !== "string") missing.push(`scheme(got:${typeof candidate.scheme})`);
  if (typeof candidate.network !== "string") missing.push(`network(got:${typeof candidate.network})`);
  if (typeof candidate.asset !== "string") missing.push(`asset(got:${typeof candidate.asset})`);
  if (typeof amount !== "string" && typeof amount !== "number") missing.push(`amount(got:${typeof amount})`);
  if (typeof payTo !== "string") missing.push(`payTo(got:${typeof payTo})`);
  if (missing.length > 0) throw new Error(`Malformed payment challenge: missing or invalid fields: ${missing.join(", ")}`);
  const result: PaymentChallenge = {
    scheme: candidate.scheme as string,
    network: candidate.network as string,
    asset: candidate.asset as string,
    amount: amount as string | number,
    payTo: payTo as string,
  };
  const validUntil = candidate.validUntil ?? extra.validUntil;
  if (typeof validUntil === "string" || typeof validUntil === "number") result.validUntil = validUntil;
  if (typeof root.x402Version === "number") result.x402Version = root.x402Version;
  return result;
}

export function publicChallengeMetadata(challenge: PaymentChallenge): Record<string, unknown> {
  return { scheme: challenge.scheme, network: challenge.network, asset: challenge.asset, amount: challenge.amount, payTo: challenge.payTo, validUntil: challenge.validUntil, x402Version: challenge.x402Version };
}
