import type { Conformance, DomainEvidence, Intent, Selection } from "./types.js";

function optionalNumber(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function optionalString(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }

export function normalizeEvidence(intent: Intent, selection: Selection, value: unknown, validationStatus: Conformance): DomainEvidence {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const base = { sourceMinerId: selection.miner.id, sourceMinerName: selection.miner.name, validationStatus, uncertainty: [] as string[], unavailableFields: [] as string[] };
  const confidence = optionalNumber(record.confidence);
  if (confidence === undefined) base.unavailableFields.push("confidence");
  const label = optionalString(record.label), reason = optionalString(record.reason), verdict = optionalString(record.verdict), transactionStatus = optionalString(record.status);
  if (intent === "FRAUD_DETECTION") return { ...base, intent, ...(confidence === undefined ? {} : { confidence }), ...(label === undefined ? {} : { label }), ...(reason === undefined ? {} : { reason }) };
  if (intent === "URL_SCAN") return { ...base, intent, ...(confidence === undefined ? {} : { confidence }), ...(verdict === undefined ? {} : { verdict }), ...(typeof record.reachable === "boolean" ? { reachable: record.reachable } : {}) };
  return { ...base, intent, ...(confidence === undefined ? {} : { confidence }), ...(transactionStatus === undefined ? {} : { transactionStatus }), ...(typeof record.block_number === "number" ? { blockNumber: record.block_number } : {}) };
}
