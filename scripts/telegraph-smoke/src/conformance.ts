import type { Conformance, JsonSchema } from "./types.js";

export function classifyConformance(value: unknown, schema: JsonSchema | null, adapterAccepted = false): Conformance {
  if (value === null || typeof value !== "object" || Array.isArray(value) || !schema) return "INVALID";
  const record = value as Record<string, unknown>;
  const required = schema.required ?? [];
  if (required.every((field) => field in record)) return "MATCH";
  if (adapterAccepted) return "COMPATIBLE_WITH_ADAPTER";
  return required.some((field) => field in record) ? "MISMATCH" : "INVALID";
}
