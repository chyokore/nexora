import assert from "node:assert/strict";
import test from "node:test";
import { parseChallenge } from "../src/challenge.js";
import { classifyConformance } from "../src/conformance.js";
import { PAYMENT_POLICY, RunLedger, validateChallenge } from "../src/policy.js";
import { buildRequest, TEST_IDS } from "../src/requests.js";
import { selectMiner } from "../src/selection.js";
import { inspectUnsignedChallenge } from "../src/transport.js";
import type { Intent, Miner, PaymentChallenge } from "../src/types.js";

const ASSET = "0x1111111111111111111111111111111111111111";
const PAYEE = "0x2222222222222222222222222222222222222222";
const challenge = (overrides: Partial<PaymentChallenge> = {}): PaymentChallenge => ({ scheme: "exact", network: PAYMENT_POLICY.network, asset: ASSET, amount: 10_000, payTo: PAYEE, validUntil: Math.floor(Date.now() / 1000) + 300, ...overrides });
const miner = (id: string, intent: Intent, rank: number, properties: string[], required: string[] = []): Miner => ({
  id, name: `Miner ${id}`, activation_status: "active", min_price_usdc: 10_000, supported_intents: [intent],
  endpoints: [{ method: "GET", path: intent === "FRAUD_DETECTION" ? "/risk-check" : intent === "URL_SCAN" ? "/url-scan" : "/lookup" }],
  input_schema: { properties: Object.fromEntries(properties.map((key) => [key, { type: "string" }])), required }, output_schema: { properties: {} },
  scores: [{ intent_id: intent, rank, score: 1 }],
});
const selection = (intent: Intent) => selectMiner([miner("49", intent, 1, intent === "FRAUD_DETECTION" ? ["query"] : intent === "URL_SCAN" ? ["url"] : ["tx_hash", "chain"], intent === "ONCHAIN_TX_LOOKUP" ? ["tx_hash"] : [])], intent);

test("neutral selection chooses best rank", () => assert.equal(selectMiner([miner("2", "URL_SCAN", 2, ["url"]), miner("9", "URL_SCAN", 1, ["url"])], "URL_SCAN").miner.id, "9"));
test("stable numeric ID breaks a complete tie", () => assert.equal(selectMiner([miner("10", "URL_SCAN", 1, ["url"]), miner("2", "URL_SCAN", 1, ["url"])], "URL_SCAN").miner.id, "2"));
test("malformed registry is rejected", () => assert.throws(() => selectMiner({}, "URL_SCAN"), /Malformed registry/));
test("wrong network is rejected", () => assert.throws(() => validateChallenge(challenge({ network: "eip155:1" }), ASSET), /Wrong payment network/));
test("over-budget call is rejected", () => assert.throws(() => validateChallenge(challenge({ amount: 10_001 }), ASSET), /Per-call/));
test("cumulative budget is rejected", () => { const ledger = new RunLedger(25_000); const s = selection("FRAUD_DETECTION"); assert.throws(() => ledger.authorize(TEST_IDS.FRAUD_DETECTION, "FRAUD_DETECTION", s, challenge(), ASSET), /Cumulative/); });
test("unexpected intent/miner pair is rejected", () => assert.throws(() => new RunLedger().authorize(TEST_IDS.URL_SCAN, "URL_SCAN", selection("FRAUD_DETECTION"), challenge(), ASSET), /Unexpected selected miner/));
test("unexpected intent is rejected", () => assert.throws(() => new RunLedger().authorize(TEST_IDS.FRAUD_DETECTION, "NOT_ALLOWED" as Intent, selection("FRAUD_DETECTION"), challenge(), ASSET), /Unexpected intent/));
test("malformed challenge is rejected", () => assert.throws(() => parseChallenge({ accepts: [{}] }), /Malformed/));
test("missing payee is rejected", () => assert.throws(() => validateChallenge(challenge({ payTo: "" }), ASSET), /payee/));
test("duplicate logical test is rejected", () => { const ledger = new RunLedger(); const s = selection("FRAUD_DETECTION"); ledger.authorize(TEST_IDS.FRAUD_DETECTION, "FRAUD_DETECTION", s, challenge(), ASSET); assert.throws(() => ledger.authorize(TEST_IDS.FRAUD_DETECTION, "FRAUD_DETECTION", s, challenge(), ASSET), /Duplicate/); });
test("asset must be explicitly approved", () => assert.throws(() => validateChallenge(challenge()), /Asset approval/));
test("malformed asset is rejected", () => assert.throws(() => validateChallenge(challenge({ asset: "USDC" }), ASSET), /Malformed asset/));
test("expired challenge is rejected", () => assert.throws(() => validateChallenge(challenge({ validUntil: 1 }), ASSET), /Expired/));
test("request builders match all three schema families", () => { assert.ok("query" in buildRequest("FRAUD_DETECTION", selection("FRAUD_DETECTION").miner)); assert.deepEqual(buildRequest("URL_SCAN", selection("URL_SCAN").miner), { url: "https://example.com" }); assert.ok("tx_hash" in buildRequest("ONCHAIN_TX_LOOKUP", selection("ONCHAIN_TX_LOOKUP").miner)); });
test("dry-run architecture has no signer dependency", async () => { const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/cli.js", import.meta.url), "utf8")); assert.doesNotMatch(source, /wrapFetchWithPayment|privateKeyToAccount|PAYMENT-SIGNATURE/); });
test("unsigned inspection sends exactly one request and never retries with payment", async () => {
  let calls = 0;
  const mockFetch = async (_input: string | URL, init?: RequestInit): Promise<Response> => {
    calls += 1;
    assert.equal(new Headers(init?.headers).has("payment-signature"), false);
    return new Response(JSON.stringify({ accepts: [challenge()] }), { status: 402, headers: { "content-type": "application/json" } });
  };
  const parsed = await inspectUnsignedChallenge("http://registry.test", selection("URL_SCAN"), { url: "https://example.com" }, mockFetch);
  assert.equal(parsed.amount, 10_000);
  assert.equal(calls, 1);
});
test("conformance helper returns only declared states", () => { assert.equal(classifyConformance({ answer: "ok" }, { required: ["answer"] }), "MATCH"); assert.equal(classifyConformance({}, { required: ["answer"] }, true), "COMPATIBLE_WITH_ADAPTER"); assert.equal(classifyConformance({ other: true }, { required: ["answer"] }), "INVALID"); });
