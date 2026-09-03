import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiServer, fetchDiscoverySummary, resolveAllowedOrigins, resolvePort, startApiServer } from "../src/api.js";
import { createDecisionPacket } from "../src/decision-packet.js";
import { contradictedOnchain, insufficientFraud, proposedSupplierPayment, strongFraudWithoutConfidence, syntheticVerifiedFraudBlock, usableUrl } from "./fixtures/action-policy-fixtures.js";

let server: Server, baseUrl: string;
before(async () => { server = createApiServer(); await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); }); const address = server.address() as AddressInfo; baseUrl = `http://127.0.0.1:${address.port}`; });
after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

const request = (path: string, body: unknown, init: RequestInit = {}) => fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...init.headers }, body: typeof body === "string" ? body : JSON.stringify(body), ...init });
const evaluate = (evidenceAssessments: unknown[], proposedAction = proposedSupplierPayment) => request("/v1/decisions/evaluate", { proposedAction, evidenceAssessments });
const json = async (response: Response): Promise<Record<string, any>> => response.json() as Promise<Record<string, any>>;

test("GET /health crosses the HTTP boundary", async () => { const response = await fetch(`${baseUrl}/health`); assert.equal(response.status, 200); assert.match(response.headers.get("content-type") ?? "", /^application\/json/); assert.deepEqual(await response.json(), { status: "ok", service: "nexora-api", version: "1" }); });
test("ALLOW evaluation returns packet and verified replay", async () => { const response = await evaluate([strongFraudWithoutConfidence, usableUrl]); const body = await json(response); assert.equal(response.status, 200); assert.equal(body.decisionPacket.actionDecision.decision, "ALLOW"); assert.equal(body.decisionReplay.validation.status, "VERIFIED"); assert.equal(body.decisionReplay.recomputedDecision.decision, "ALLOW"); });
test("fraud out-of-coverage evaluation returns REVIEW and confidence zero", async () => { const body = await json(await evaluate([insufficientFraud, usableUrl])); assert.equal(body.decisionPacket.actionDecision.decision, "REVIEW"); assert.equal(body.decisionReplay.validation.status, "VERIFIED"); assert.equal(body.decisionReplay.evidence.find((item: any) => item.intent === "FRAUD_DETECTION").providerConfidence, 0); });
test("contradicted onchain evaluation returns REVIEW with confidence one", async () => { const action = { ...proposedSupplierPayment, subject: { ...proposedSupplierPayment.subject, transactionHash: "0xsanitized-transaction-reference" } }; const body = await json(await evaluate([strongFraudWithoutConfidence, usableUrl, contradictedOnchain], action)); const evidence = body.decisionReplay.evidence.find((item: any) => item.intent === "ONCHAIN_TX_LOOKUP"); assert.equal(body.decisionPacket.actionDecision.decision, "REVIEW"); assert.equal(body.decisionReplay.validation.status, "VERIFIED"); assert.equal(evidence.providerConfidence, 1); assert.equal(evidence.verification, "CONTRADICTED"); assert.equal(evidence.quality, "CONTRADICTED"); });
test("synthetic verified adverse evaluation returns BLOCK", async () => { const body = await json(await evaluate([syntheticVerifiedFraudBlock, usableUrl])); assert.equal(body.decisionPacket.actionDecision.decision, "BLOCK"); assert.equal(body.decisionReplay.validation.status, "VERIFIED"); });
test("replay endpoint returns MISMATCH for tampered recorded decision", async () => { const packet = structuredClone(createDecisionPacket("review", proposedSupplierPayment, [insufficientFraud, usableUrl])); packet.actionDecision.decision = "ALLOW"; const response = await request("/v1/replays/verify", packet); const body = await json(response); assert.equal(response.status, 200); assert.equal(body.validation.status, "MISMATCH"); assert.deepEqual(body.validation.mismatches, ["actionDecision.decision"]); });
test("replay endpoint returns unsupported version as successful replay operation", async () => { const packet = structuredClone(createDecisionPacket("allow", proposedSupplierPayment, [strongFraudWithoutConfidence, usableUrl])) as unknown as Record<string, unknown>; packet.version = 2; const response = await request("/v1/replays/verify", packet); assert.equal(response.status, 200); assert.equal((await json(response)).validation.status, "UNSUPPORTED_VERSION"); });
test("replay endpoint returns invalid packet for missing version", async () => { const packet = structuredClone(createDecisionPacket("allow", proposedSupplierPayment, [strongFraudWithoutConfidence, usableUrl])) as unknown as Record<string, unknown>; delete packet.version; const response = await request("/v1/replays/verify", packet); assert.equal(response.status, 200); assert.equal((await json(response)).validation.status, "INVALID_PACKET"); });
test("invalid JSON returns consistent 400 error", async () => { const response = await request("/v1/decisions/evaluate", "{"); const body = await json(response); assert.equal(response.status, 400); assert.equal(body.error.code, "INVALID_JSON"); assert.equal("stack" in body.error, false); });
test("empty body returns 400", async () => { const response = await request("/v1/decisions/evaluate", ""); assert.equal(response.status, 400); assert.equal((await json(response)).error.code, "EMPTY_BODY"); });
test("wrong content type returns 415", async () => { const response = await fetch(`${baseUrl}/v1/decisions/evaluate`, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }); assert.equal(response.status, 415); assert.equal((await json(response)).error.code, "UNSUPPORTED_MEDIA_TYPE"); });
test("missing proposedAction is rejected", async () => { const response = await request("/v1/decisions/evaluate", { evidenceAssessments: [] }); assert.equal(response.status, 400); assert.ok((await json(response)).error.details.includes("request:invalid_proposed_action")); });
test("invalid action type is rejected without coercion", async () => { const action = { ...proposedSupplierPayment, type: "OTHER" }; const response = await evaluate([], action as never); assert.equal(response.status, 400); });
test("malformed evidenceAssessments is rejected", async () => { const response = await request("/v1/decisions/evaluate", { proposedAction: proposedSupplierPayment, evidenceAssessments: {} }); assert.equal(response.status, 400); });
test("invalid evidence quality enum is rejected", async () => { const evidence = { ...strongFraudWithoutConfidence, quality: "CERTAIN" }; const response = await evaluate([evidence, usableUrl]); assert.equal(response.status, 400); assert.ok((await json(response)).error.details.includes("request:invalid_evidence_assessments")); });
test("invalid verification enum is rejected", async () => { const evidence = { ...strongFraudWithoutConfidence, verification: "TRUST_ME" }; assert.equal((await evaluate([evidence, usableUrl])).status, 400); });
test("arbitrary policy injection is rejected", async () => { const response = await request("/v1/decisions/evaluate", { proposedAction: proposedSupplierPayment, evidenceAssessments: [strongFraudWithoutConfidence, usableUrl], policy: { arbitrary: true } }); assert.equal(response.status, 400); assert.ok((await json(response)).error.details.includes("request:unexpected_fields")); });
test("oversized request returns 413", async () => { const action = { ...proposedSupplierPayment, description: "x".repeat(70_000) }; const response = await evaluate([], action); assert.equal(response.status, 413); assert.equal((await json(response)).error.code, "REQUEST_TOO_LARGE"); });
test("unknown route returns 404", async () => { const response = await fetch(`${baseUrl}/missing`); assert.equal(response.status, 404); assert.equal((await json(response)).error.code, "NOT_FOUND"); });
test("incorrect method returns 405 and Allow", async () => { const response = await fetch(`${baseUrl}/health`, { method: "POST" }); assert.equal(response.status, 405); assert.equal(response.headers.get("allow"), "GET"); });
test("allowed browser origin receives restrictive CORS headers", async () => { const response = await fetch(`${baseUrl}/health`, { headers: { origin: "http://127.0.0.1:5173" } }); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173"); assert.notEqual(response.headers.get("access-control-allow-origin"), "*"); });
test("disallowed browser origin is rejected", async () => { const response = await fetch(`${baseUrl}/health`, { headers: { origin: "https://attacker.example" } }); assert.equal(response.status, 403); assert.equal((await json(response)).error.code, "ORIGIN_NOT_ALLOWED"); });
test("no-origin server request remains allowed", async () => { assert.equal((await fetch(`${baseUrl}/health`)).status, 200); });
test("allowed preflight returns explicit methods and origin", async () => { const response = await fetch(`${baseUrl}/v1/decisions/evaluate`, { method: "OPTIONS", headers: { origin: "http://localhost:5173", "access-control-request-method": "POST" } }); assert.equal(response.status, 204); assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173"); assert.match(response.headers.get("access-control-allow-methods") ?? "", /POST/); });
test("CORS origin configuration is normalized, includes local development, and never wildcarded", () => { assert.deepEqual(resolveAllowedOrigins("https://nexora.vercel.app/, https://nexora.vercel.app,invalid,*"), ["http://127.0.0.1:5173", "http://localhost:5173", "https://nexora.vercel.app"]); });
test("deterministic evaluation request produces byte-identical response", async () => { const first = await (await evaluate([strongFraudWithoutConfidence, usableUrl])).text(); const second = await (await evaluate([strongFraudWithoutConfidence, usableUrl])).text(); assert.equal(first, second); });
test("PORT parser honors valid values and rejects coercion", () => { assert.equal(resolvePort("8080"), 8080); assert.equal(resolvePort("0"), 0); assert.equal(resolvePort(undefined), 3000); assert.throws(() => resolvePort("1.5")); assert.throws(() => resolvePort("70000")); });
test("startApiServer starts and closes on an ephemeral port without credentials", async () => { const previous = process.env.TELEGRAPH_EVM_PRIVATE_KEY; delete process.env.TELEGRAPH_EVM_PRIVATE_KEY; const temporary = await startApiServer(0); assert.ok((temporary.address() as AddressInfo).port > 0); await new Promise<void>((resolve, reject) => temporary.close((error) => error ? reject(error) : resolve())); if (previous !== undefined) process.env.TELEGRAPH_EVM_PRIVATE_KEY = previous; });
test("API dependency chain reuses core and imports no live/payment modules", async () => { const files = ["api.js", "decision-packet.js", "decision-replay.js", "action-policy.js"]; const source = (await Promise.all(files.map((file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8")))).join("\n"); assert.match(source, /createDecisionPacket/); assert.match(source, /replayDecisionPacket/); assert.match(source, /evaluateRecordedPolicy/); assert.doesNotMatch(source, /from ["'].+(payment-adapter|transport|registry)|wrapFetchWithPayment|privateKeyToAccount|TELEGRAPH_EVM_PRIVATE_KEY/); });

test("fetchDiscoverySummary formats neutral discovery and handles mock registry", async () => {
  const mockRegistry = [
    {
      id: "miner-1",
      name: "Mock Fraud Miner",
      activation_status: "active",
      min_price_usdc: 10000,
      supported_intents: ["FRAUD_DETECTION"],
      endpoints: [{ method: "GET", path: "/assess", description: "FRAUD_DETECTION assessment" }],
      input_schema: { properties: { query: { type: "string" } }, required: ["query"] },
      output_schema: { properties: { verdict: { type: "string" } } },
      scores: [{ intent_id: "FRAUD_DETECTION", rank: 1, score: 0.99 }],
    },
  ];
  const mockFetch: typeof fetch = async () => new Response(JSON.stringify(mockRegistry), { status: 200, headers: { "content-type": "application/json" } });
  const result = (await fetchDiscoverySummary("http://mock-node:7044", mockFetch)) as any;
  assert.equal(result.status, "ok");
  assert.equal(result.discoveryType, "FREE_REGISTRY_INSPECTION");
  assert.equal(result.totalRegistrations, 1);
  assert.equal(result.discovery.FRAUD_DETECTION.eligibleCount, 1);
  assert.equal(result.discovery.FRAUD_DETECTION.winner.name, "Mock Fraud Miner");
});

test("fetchDiscoverySummary rejects non-array registry", async () => {
  const mockFetch: typeof fetch = async () => new Response(JSON.stringify({ error: "none" }), { status: 200, headers: { "content-type": "application/json" } });
  await assert.rejects(async () => fetchDiscoverySummary("http://mock-node:7044", mockFetch), /Malformed registry/);
});

test("GET /v1/discovery returns 200 or 503 structured error without throwing unhandled exceptions", async () => {
  const response = await fetch(`${baseUrl}/v1/discovery`);
  assert.ok(response.status === 200 || response.status === 503);
  const body = (await response.json()) as any;
  if (response.status === 200) {
    assert.equal(body.status, "ok");
    assert.equal(body.discoveryType, "FREE_REGISTRY_INSPECTION");
    assert.ok(body.discovery.FRAUD_DETECTION !== undefined);
  } else {
    assert.equal(body.error.code, "DISCOVERY_UNAVAILABLE");
    assert.equal(body.error.message, "Live discovery temporarily unavailable");
  }
});

test("POST /v1/discovery returns 405 Method Not Allowed", async () => {
  const response = await fetch(`${baseUrl}/v1/discovery`, { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
});
