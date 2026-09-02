import { classifyConformance } from "./conformance.js";
import { normalizeEvidence } from "./normalization.js";
import { RunLedger } from "./policy.js";
import { validateChallenge } from "./policy.js";
import { parseChallenge } from "./challenge.js";
import { buildMinerRequest, inspectUnsignedChallenge, type FetchLike } from "./transport.js";
import type { CaptureRecord, Intent, Selection } from "./types.js";

export interface ExecutionEnvironment { privateKey: `0x${string}`; network: "eip155:84532"; approvedAsset: `0x${string}`; }
export type PaymentFetchFactory = (privateKey: `0x${string}`, network: "eip155:84532", baseFetch: FetchLike) => Promise<FetchLike>;

export function requireExecutionEnvironment(env: NodeJS.ProcessEnv, approvedAsset?: string): ExecutionEnvironment {
  const privateKey = env.TELEGRAPH_EVM_PRIVATE_KEY;
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey ?? "")) throw new Error("A valid TELEGRAPH_EVM_PRIVATE_KEY is required");
  if (env.EVM_NETWORK !== "eip155:84532") throw new Error("Payment execution requires EVM_NETWORK=eip155:84532");
  if (!/^0x[a-fA-F0-9]{40}$/.test(approvedAsset ?? "")) throw new Error("A valid explicitly approved asset is required");
  return { privateKey: privateKey as `0x${string}`, network: "eip155:84532", approvedAsset: approvedAsset as `0x${string}` };
}

export async function officialPaymentFetch(privateKey: `0x${string}`, network: "eip155:84532", baseFetch: FetchLike = fetch): Promise<FetchLike> {
  const [{ wrapFetchWithPayment, x402Client }, { ExactEvmScheme, toClientEvmSigner }, { privateKeyToAccount }] = await Promise.all([import("@x402/fetch"), import("@x402/evm"), import("viem/accounts")]);
  const signer = toClientEvmSigner(privateKeyToAccount(privateKey));
  const client = x402Client.fromConfig({ schemes: [{ network, client: new ExactEvmScheme(signer) }] });
  return wrapFetchWithPayment(baseFetch, client);
}

export async function executeGuardedPaidCall(options: { nodeUrl: string; logicalTestId: string; intent: Intent; selection: Selection; payload: Record<string, string | number>; environment: ExecutionEnvironment; ledger: RunLedger; unsignedFetch?: FetchLike; paymentFetchFactory?: PaymentFetchFactory; }): Promise<CaptureRecord> {
  const started = Date.now();
  const challenge = await inspectUnsignedChallenge(options.nodeUrl, options.selection, options.payload, options.unsignedFetch ?? fetch);
  options.ledger.authorize(options.logicalTestId, options.intent, options.selection, challenge, options.environment.approvedAsset);
  const { url, init } = buildMinerRequest(options.nodeUrl, options.selection, options.payload);
  const rawFetch = options.unsignedFetch ?? fetch;
  const guardedFetch: FetchLike = async (input, guardedInit) => {
    const response = await rawFetch(input, { ...guardedInit, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) throw new Error("Unexpected redirect/payment target substitution");
    if (response.status === 402) {
      const header = response.headers.get("payment-required");
      const repeated = header ? parseChallenge(header) : parseChallenge(await response.clone().json());
      validateChallenge(repeated, options.environment.approvedAsset);
      for (const field of ["scheme", "network", "asset", "amount", "payTo"] as const) if (String(repeated[field]).toLowerCase() !== String(challenge[field]).toLowerCase()) throw new Error("Payment challenge changed after preflight");
    }
    return response;
  };
  const paymentFetch = await (options.paymentFetchFactory ?? officialPaymentFetch)(options.environment.privateKey, options.environment.network, guardedFetch);
  const response = await paymentFetch(url, init);
  if (response.url && new URL(response.url).origin !== url.origin) throw new Error("Unexpected redirect/payment target substitution");
  const raw = await response.json() as unknown;
  const conformance = classifyConformance(raw, options.selection.miner.output_schema);
  const rawShape = Array.isArray(raw) ? "array" : raw === null ? "null" : typeof raw;
  const settlementHeader = response.headers.get("payment-response");
  let settlementMetadata: unknown;
  if (settlementHeader) { try { settlementMetadata = JSON.parse(Buffer.from(settlementHeader, "base64").toString("utf8")); } catch { settlementMetadata = { present: true, parseable: false }; } }
  return { logicalTestId: options.logicalTestId, intent: options.intent, selectedMinerId: options.selection.miner.id, selectedMinerName: options.selection.miner.name, registryRank: options.selection.score.rank, registryScore: options.selection.score.score, endpoint: options.selection.endpoint.path, requestContract: options.selection.schemaFamily, requestSchemaFamily: options.selection.schemaFamily, httpStatusSequence: [402, 402, response.status], httpNegotiationSteps: ["guard preflight unsigned challenge", "x402 client unsigned negotiation", "x402 authorized retry"], x402Version: challenge.x402Version as number, paymentNetwork: challenge.network, paymentAsset: challenge.asset, authorizedAmount: Number(challenge.amount), actualChallengeAmount: Number(challenge.amount), telegraphResponseMetadata: { contentType: response.headers.get("content-type"), rawShape }, minerResponse: raw, durationMs: Date.now() - started, timestamp: new Date().toISOString(), advertisedPrice: options.selection.miner.min_price_usdc, settlementOccurred: Boolean(settlementHeader), ...(settlementMetadata === undefined ? {} : { settlementMetadata }), normalizedEvidence: normalizeEvidence(options.intent, options.selection, raw, conformance), errors: response.ok ? [] : [`HTTP ${response.status}`], conformance };
}

export function sanitizeForOutput(value: unknown): string {
  const text = JSON.stringify(value);
  return text.replace(/0x[a-fA-F0-9]{64}/g, "<redacted-64-byte-secret-or-signature>").replace(/(privateKey|authorization|payment-signature|x-sigvora-key)\"?:\"[^\"]+/gi, "$1:<redacted>");
}
