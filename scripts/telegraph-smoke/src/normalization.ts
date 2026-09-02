import type { Conformance, DomainEvidence, Intent, Selection } from "./types.js";

function optionalNumber(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function optionalString(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }

export function normalizeEvidence(intent: Intent, selection: Selection, value: unknown, validationStatus: Conformance): DomainEvidence {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const base = { sourceMinerId: selection.miner.id, sourceMinerName: selection.miner.name, validationStatus, uncertainty: [] as string[], unavailableFields: [] as string[] };
  const confidence = optionalNumber(record.confidence);
  if (confidence === undefined) base.unavailableFields.push("confidence");
  const verdict = optionalString(record.verdict);
  const label = optionalString(record.label) ?? verdict, reason = optionalString(record.reason) ?? optionalString(record.reasoning), transactionStatus = optionalString(record.status);
  if (intent === "FRAUD_DETECTION") {
    if (label === undefined) base.unavailableFields.push("label");
    if (reason === undefined) base.unavailableFields.push("reason");
    if (record.coverage_complete === false) base.uncertainty.push("coverage_incomplete");
    if (record.data_source === "unavailable") base.uncertainty.push("data_source_unavailable");
    if (record.risk_tier === "insufficient_data") base.uncertainty.push("insufficient_data");
    return { ...base, intent, ...(confidence === undefined ? {} : { confidence }), ...(label === undefined ? {} : { label }), ...(reason === undefined ? {} : { reason }) };
  }
  if (intent === "URL_SCAN") return { ...base, intent, ...(confidence === undefined ? {} : { confidence }), ...(verdict === undefined ? {} : { verdict }), ...(typeof record.reachable === "boolean" ? { reachable: record.reachable } : {}) };
  return { ...base, intent, ...(confidence === undefined ? {} : { confidence }), ...(transactionStatus === undefined ? {} : { transactionStatus }), ...(typeof record.block_number === "number" ? { blockNumber: record.block_number } : {}) };
}
