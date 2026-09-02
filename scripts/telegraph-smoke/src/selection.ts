import type { DiscoveryIntent, Endpoint, Miner, Selection } from "./types.js";

function isStringProperty(miner: Miner, name: string): boolean {
  const type = miner.input_schema?.properties?.[name]?.type;
  return type === "string" || (Array.isArray(type) && type.includes("string"));
}

function requiredSubset(miner: Miner, allowed: string[]): boolean {
  return (miner.input_schema?.required ?? []).every((field) => allowed.includes(field));
}

export function compatible(miner: Miner, intent: DiscoveryIntent): boolean {
  if (miner.activation_status !== "active" || !Number.isInteger(miner.min_price_usdc) || miner.min_price_usdc <= 0) return false;
  if (!miner.input_schema || !miner.output_schema || !miner.supported_intents.includes(intent)) return false;

  if (intent === "FRAUD_DETECTION") return isStringProperty(miner, "query") && requiredSubset(miner, ["query"]);
  if (intent === "URL_SCAN") return isStringProperty(miner, "url") && requiredSubset(miner, ["url"]);
  if (intent === "FACT_CHECK" || intent === "NEWS_SEARCH") return isStringProperty(miner, "query") && requiredSubset(miner, ["query"]);

  const identifier = ["tx_hash", "hash", "txHash"].some((field) => isStringProperty(miner, field));
  return identifier && requiredSubset(miner, ["tx_hash", "hash", "txHash", "chain", "chainId", "query"]);
}

function endpointFor(miner: Miner, intent: DiscoveryIntent): Endpoint {
  const patterns: Record<DiscoveryIntent, RegExp> = {
    FRAUD_DETECTION: /fraud|risk|anomaly|assess/i,
    URL_SCAN: /url|scan/i,
    ONCHAIN_TX_LOOKUP: /transaction|tx|lookup/i,
    FACT_CHECK: /fact|check|verify|search/i,
    NEWS_SEARCH: /news|search/i,
  };
  const endpoint = miner.endpoints.find((item) => patterns[intent].test(`${item.path} ${item.description ?? ""}`));
  if (!endpoint || !/^(GET|POST)$/i.test(endpoint.method) || !endpoint.path.startsWith("/")) {
    throw new Error(`Malformed registry result for miner ${miner.id}: no compatible endpoint`);
  }
  return { method: endpoint.method.toUpperCase(), path: endpoint.path };
}

function stableIdCompare(left: string, right: string): number {
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) return BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0;
  return left.localeCompare(right);
}

export function eligibleSelections(registry: unknown, intent: DiscoveryIntent): Selection[] {
  if (!Array.isArray(registry)) throw new Error("Malformed registry result: expected an array");
  const eligible = (registry as Miner[]).filter((miner) => compatible(miner, intent)).map((miner) => {
    const score = miner.scores?.find((item) => item.intent_id === intent);
    if (!score || !Number.isInteger(score.rank) || score.rank < 1 || !Number.isFinite(score.score)) return null;
    return { miner, score };
  }).filter((item): item is { miner: Miner; score: NonNullable<typeof item>["score"] } => item !== null);

  eligible.sort((a, b) => a.score.rank - b.score.rank || b.score.score - a.score.score || stableIdCompare(a.miner.id, b.miner.id));
  return eligible.flatMap((winner) => {
    try { return [{ ...winner, endpoint: endpointFor(winner.miner, intent), schemaFamily: intent === "URL_SCAN" ? "declared-url" : intent === "ONCHAIN_TX_LOOKUP" ? "transaction-identifier" : "query-only" }]; }
    catch { return []; }
  });
}

export function selectMiner(registry: unknown, intent: DiscoveryIntent): Selection {
  const winner = eligibleSelections(registry, intent)[0];
  if (!winner) throw new Error(`No eligible miner for ${intent}`);
  return winner;
}
