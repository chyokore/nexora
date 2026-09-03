import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createDecisionPacket, type DecisionPacket } from "./decision-packet.js";
import { canonicalSerialize, replayDecisionPacket, sanitizeReplayValue, validateEvidenceAssessment, validateProposedAction } from "./decision-replay.js";
import { eligibleSelections } from "./selection.js";
import { DISCOVERY_INTENTS, type DiscoveryIntent, type Miner } from "./types.js";
import type { ProposedAction } from "./action-policy.js";
import type { EvidenceAssessment } from "./types.js";
import { LiveDecisionGuard } from "./live-guard.js";
import { runReferenceAgent, requireExecutionEnvironment, inspectSignerConfig, type ReferenceAgentRunResult } from "./reference-agent.js";

const API_VERSION = "1";
const MAX_BODY_BYTES = 65_536;
const routes = new Set(["/health", "/v1/discovery", "/v1/decisions/evaluate", "/v1/replays/verify", "/v1/agent/run"]);
/** Shared in-process guard — stats reset on server restart. */
const liveGuard = new LiveDecisionGuard();
const LOCAL_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"];

export interface ApiServerOptions { allowedOrigins?: readonly string[]; logRequests?: boolean }

interface ApiErrorBody { error: { code: string; message: string; details: string[] } }
class RequestError extends Error { constructor(readonly status: number, readonly code: string, message: string, readonly details: string[] = []) { super(message); } }

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(sanitizeReplayValue(body));
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(json), "cache-control": "no-store" });
  response.end(json);
}

function sendError(response: ServerResponse, status: number, code: string, message: string, details: string[] = []): void {
  const body: ApiErrorBody = { error: { code, message, details: [...details].sort() } };
  sendJson(response, status, body);
}

export function resolveAllowedOrigins(value = process.env.CORS_ALLOWED_ORIGINS): string[] {
  const configured = value?.split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter((origin) => /^https?:\/\/[^/]+$/i.test(origin)) ?? [];
  return [...new Set([...LOCAL_ORIGINS, ...configured])].sort();
}

function applyCors(request: IncomingMessage, response: ServerResponse, allowedOrigins: ReadonlySet<string>): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  response.setHeader("vary", "Origin");
  if (!allowedOrigins.has(origin)) { sendError(response, 403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed"); return false; }
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "Content-Type");
  response.setHeader("access-control-max-age", "600");
  return true;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"] ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) throw new RequestError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  let size = 0, oversized = false;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) oversized = true;
    else chunks.push(buffer);
  }
  if (oversized) throw new RequestError(413, "REQUEST_TOO_LARGE", "Request body exceeds 65536 bytes");
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") throw new RequestError(400, "EMPTY_BODY", "A JSON request body is required");
  try { return JSON.parse(text); } catch { throw new RequestError(400, "INVALID_JSON", "Request body is not valid JSON"); }
}

function evaluationInput(value: unknown): { proposedAction: ProposedAction; evidenceAssessments: EvidenceAssessment[] } {
  const details: string[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new RequestError(400, "VALIDATION_ERROR", "Evaluation request is invalid", ["request:not_object"]);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "proposedAction" && key !== "evidenceAssessments")) details.push("request:unexpected_fields");
  if (!validateProposedAction(record.proposedAction)) details.push("request:invalid_proposed_action");
  if (!Array.isArray(record.evidenceAssessments) || !record.evidenceAssessments.every(validateEvidenceAssessment)) details.push("request:invalid_evidence_assessments");
  if (details.length > 0) throw new RequestError(400, "VALIDATION_ERROR", "Evaluation request is invalid", details);
  return record as unknown as { proposedAction: ProposedAction; evidenceAssessments: EvidenceAssessment[] };
}

function decisionIdFor(input: { proposedAction: ProposedAction; evidenceAssessments: EvidenceAssessment[] }): string {
  const digest = createHash("sha256").update(canonicalSerialize(sanitizeReplayValue(input))).digest("hex");
  return `decision:${digest}`;
}

export async function fetchDiscoverySummary(nodeUrl: string, fetchFn: typeof fetch = fetch): Promise<unknown> {
  const registryUrl = new URL("/miner-dispatcher/integrations", nodeUrl);
  const res = await fetchFn(registryUrl, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Free registry request failed with HTTP ${res.status}`);
  const registry = (await res.json()) as Miner[];
  if (!Array.isArray(registry)) throw new Error("Malformed registry result: expected an array");
  const discovery = Object.fromEntries(
    DISCOVERY_INTENTS.map((intent) => {
      const eligible = eligibleSelections(registry, intent);
      const top = eligible[0];
      const winner = top
        ? {
            id: top.miner.id,
            name: top.miner.name,
            rank: top.score.rank,
            score: top.score.score,
            method: top.endpoint.method,
            endpoint: top.endpoint.path,
            schemaFamily: top.schemaFamily,
            advertisedPriceMicroUsdc: top.miner.min_price_usdc,
          }
        : null;
      return [intent, { eligibleCount: eligible.length, winner }];
    })
  );
  return {
    status: "ok",
    service: "nexora-api",
    discoveryType: "FREE_REGISTRY_INSPECTION",
    timestamp: new Date().toISOString(),
    totalRegistrations: registry.length,
    discovery,
  };
}

function agentRunInput(value: unknown): { proposedAction: ProposedAction; userQuestion?: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError(400, "VALIDATION_ERROR", "Agent run request is invalid", ["request:not_object"]);
  }
  const record = value as Record<string, unknown>;
  const details: string[] = [];
  const allowed = new Set(["proposedAction", "userQuestion"]);
  if (Object.keys(record).some((k) => !allowed.has(k))) details.push("request:unexpected_fields");
  if (!validateProposedAction(record.proposedAction)) details.push("request:invalid_proposed_action");
  if (record.userQuestion !== undefined && typeof record.userQuestion !== "string") details.push("request:invalid_user_question");
  if (details.length > 0) throw new RequestError(400, "VALIDATION_ERROR", "Agent run request is invalid", details);
  return record as { proposedAction: ProposedAction; userQuestion?: string };
}

async function handle(request: IncomingMessage, response: ServerResponse, allowedOrigins: ReadonlySet<string>): Promise<void> {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  if (!routes.has(path)) { sendError(response, 404, "NOT_FOUND", "Route not found"); return; }
  if (!applyCors(request, response, allowedOrigins)) return;
  if (request.method === "OPTIONS") { response.writeHead(204, { "cache-control": "no-store" }); response.end(); return; }
  const requiredMethod = (path === "/health" || path === "/v1/discovery") ? "GET" : "POST";
  if (request.method !== requiredMethod) { response.setHeader("allow", requiredMethod); sendError(response, 405, "METHOD_NOT_ALLOWED", `Use ${requiredMethod} for this route`); return; }
  if (path === "/health") {
    const signerStatus = inspectSignerConfig(process.env);
    sendJson(response, 200, {
      status: "ok",
      service: "nexora-api",
      version: API_VERSION,
      liveDecision: {
        enabled: liveGuard.isEnabled(),
        ...signerStatus,
      },
    });
    return;
  }
  if (path === "/v1/discovery") {
    const nodeUrl = process.env.TELEGRAPH_NODE_URL ?? "http://13.237.89.59:7044";
    try {
      const summary = await fetchDiscoverySummary(nodeUrl);
      sendJson(response, 200, summary);
    } catch {
      sendError(response, 503, "DISCOVERY_UNAVAILABLE", "Live discovery temporarily unavailable", ["Telegraph registry node is unreachable or returned an error"]);
    }
    return;
  }
  const body = await readJson(request);
  if (path === "/v1/agent/run") {
    // Emergency disable switch
    if (!liveGuard.isEnabled()) {
      sendError(response, 503, "LIVE_AGENT_DISABLED", "Live decisions are currently disabled", ["Set ENABLE_LIVE_REFERENCE_AGENT=true to enable"]);
      return;
    }
    const { proposedAction, userQuestion } = agentRunInput(body);
    // Rate limiting — extract client IP from x-forwarded-for header behind proxies, or fallback to socket address
    const forwardedHeader = request.headers["x-forwarded-for"];
    const rawIp = (typeof forwardedHeader === "string" ? forwardedHeader.split(",")[0]?.trim() : null) || request.socket?.remoteAddress || "unknown";
    const clientKey = rawIp.replace(/^::ffff:/, "");
    const gate = liveGuard.canRun(clientKey);
    if (!gate.allowed) {
      sendError(response, 429, "RATE_LIMITED", "Too many live decision requests", [gate.reason ?? "RATE_LIMITED"]);
      return;
    }
    // Resolve execution environment — this will throw if credentials are absent
    let environment;
    try {
      const approvedAsset = process.env.TELEGRAPH_APPROVED_ASSET ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
      environment = requireExecutionEnvironment(process.env, approvedAsset);
    } catch (err) {
      sendError(response, 503, "ENVIRONMENT_NOT_CONFIGURED", "Live decisions are not configured on this deployment", [err instanceof Error ? err.message : "Missing credentials"]);
      return;
    }
    const nodeUrl = process.env.TELEGRAPH_NODE_URL ?? "http://13.237.89.59:7044";
    // Register the run with the guard (will assign run ID internally via runReferenceAgent)
    // We begin the guard BEFORE the async call so concurrency accounting is correct
    const beginClientKey = clientKey;
    liveGuard.beginRun(randomUUID(), beginClientKey);
    let result: ReferenceAgentRunResult;
    try {
      result = await runReferenceAgent({
        proposedAction,
        ...(userQuestion !== undefined ? { userQuestion } : {}),
        nodeUrl,
        fetchRegistry: fetch,
        environment,
      });
    } catch (err) {
      liveGuard.endRun("REVIEW", 0, 0);
      sendError(response, 500, "AGENT_RUN_FAILED", "The live decision run encountered an unexpected error");
      return;
    }
    liveGuard.endRun(result.actionDecision.decision, result.totalSettledMicroUsdc, result.paidCallCount);
    sendJson(response, 200, sanitizeReplayValue(result));
    return;
  }

  if (path === "/v1/decisions/evaluate") {
    const input = evaluationInput(body);
    const decisionPacket = createDecisionPacket(decisionIdFor(input), input.proposedAction, input.evidenceAssessments);
    const decisionReplay = replayDecisionPacket(decisionPacket);
    sendJson(response, 200, { decisionPacket, decisionReplay });
    return;
  }
  const decisionReplay = replayDecisionPacket(body as DecisionPacket);
  sendJson(response, 200, decisionReplay);
}


export function createApiServer(options: ApiServerOptions = {}): Server {
  const allowedOrigins = new Set(options.allowedOrigins ?? resolveAllowedOrigins());
  return createServer((request, response) => {
    const startedAt = performance.now();
    const requestId = randomUUID();
    response.setHeader("x-request-id", requestId);
    if (options.logRequests) response.once("finish", () => console.log(JSON.stringify({ requestId, method: request.method ?? "UNKNOWN", route: new URL(request.url ?? "/", "http://localhost").pathname, status: response.statusCode, durationMs: Math.round(performance.now() - startedAt) })));
    handle(request, response, allowedOrigins).catch((error: unknown) => {
    if (error instanceof RequestError) sendError(response, error.status, error.code, error.message, error.details);
    else sendError(response, 500, "INTERNAL_ERROR", "Unexpected server error");
    });
  });
}

export function resolvePort(value = process.env.PORT): number {
  if (value === undefined || value === "") return 3000;
  if (!/^\d+$/.test(value)) throw new Error("PORT must be an integer from 0 through 65535");
  const port = Number(value);
  if (port < 0 || port > 65_535) throw new Error("PORT must be an integer from 0 through 65535");
  return port;
}

export async function startApiServer(port = resolvePort()): Promise<Server> {
  const server = createApiServer({ logRequests: true });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "0.0.0.0", resolve); });
  return server;
}
