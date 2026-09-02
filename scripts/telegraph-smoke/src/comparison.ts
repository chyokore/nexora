export type ComparisonState = "MATCH" | "MISMATCH" | "NOT_COMPARABLE" | "UNAVAILABLE";

function comparable(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : String(value);
}

export function compareField(independent: unknown, supplied: unknown): ComparisonState {
  if (supplied === undefined || supplied === null) return "UNAVAILABLE";
  if (independent === undefined || independent === null) return "NOT_COMPARABLE";
  return comparable(independent) === comparable(supplied) ? "MATCH" : "MISMATCH";
}

export function compareTransactionEvidence(independent: Record<string, unknown>, supplied: Record<string, unknown>): Record<string, ComparisonState> {
  return {
    transactionHash: compareField(independent.hash, supplied.tx_hash),
    chain: compareField(independent.chain, supplied.chain),
    blockNumber: compareField(independent.blockNumber, supplied.block_number),
    from: compareField(independent.from, supplied.from),
    to: compareField(independent.to, supplied.to),
    valueWei: compareField(independent.valueWei, supplied.value_wei),
    receiptStatus: compareField(independent.receiptStatus, supplied.receipt_status ?? supplied.status),
  };
}
