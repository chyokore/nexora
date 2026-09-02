import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createDecisionPacket, type DecisionPacket } from "./decision-packet.js";
import { canonicalSerialize, replayDecisionPacket, sanitizeReplayValue, validateEvidenceAssessment, validateProposedAction } from "./decision-replay.js";
import type { ProposedAction } from "./action-policy.js";
import type { EvidenceAssessment } from "./types.js";

const API_VERSION = "1";
const MAX_BODY_BYTES = 65_536;
const routes = new Set(["/health", "/v1/decisions/evaluate", "/v1/replays/verify"]);

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

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  if (!routes.has(path)) { sendError(response, 404, "NOT_FOUND", "Route not found"); return; }
  const requiredMethod = path === "/health" ? "GET" : "POST";
  if (request.method !== requiredMethod) { response.setHeader("allow", requiredMethod); sendError(response, 405, "METHOD_NOT_ALLOWED", `Use ${requiredMethod} for this route`); return; }
  if (path === "/health") { sendJson(response, 200, { status: "ok", service: "nexora-api", version: API_VERSION }); return; }
  const body = await readJson(request);
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

export function createApiServer(): Server {
  return createServer((request, response) => { handle(request, response).catch((error: unknown) => {
    if (error instanceof RequestError) sendError(response, error.status, error.code, error.message, error.details);
    else sendError(response, 500, "INTERNAL_ERROR", "Unexpected server error");
  }); });
}

export function resolvePort(value = process.env.PORT): number {
  if (value === undefined || value === "") return 3000;
  if (!/^\d+$/.test(value)) throw new Error("PORT must be an integer from 0 through 65535");
  const port = Number(value);
  if (port < 0 || port > 65_535) throw new Error("PORT must be an integer from 0 through 65535");
  return port;
}

export async function startApiServer(port = resolvePort()): Promise<Server> {
  const server = createApiServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "0.0.0.0", resolve); });
  return server;
}
