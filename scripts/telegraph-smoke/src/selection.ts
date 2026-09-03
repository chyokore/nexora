import type { DiscoveryIntent, Endpoint, Miner, Selection } from "./types.js";

function isStringProperty(miner: Miner, name: string): boolean {
  const type = miner.input_schema?.properties?.[name]?.type;
  return type === "string" || (Array.isArray(type) && type.includes("string"));
}

function requiredSubset(miner: Miner, allowed: string[]): boolean {
  return (miner.input_schema?.required ?? []).every((field) => allowed.includes(field));
}

const DECLARED_INTENT = /\b(FRAUD_DETECTION|URL_SCAN|ONCHAIN_TX_LOOKUP|FACT_CHECK|NEWS_SEARCH)\b/g;

export function endpointCompatible(endpoint: Endpoint, intent: DiscoveryIntent): boolean {
  if (!/^(GET|POST)$/i.test(endpoint.method) || !endpoint.path.startsWith("/")) return false;

  const description = endpoint.description ?? "";
  const declarations = [...new Set(description.match(DECLARED_INTENT) ?? [])];
  if (declarations.length > 0) return declarations.length === 1 && declarations[0] === intent;

  const path = endpoint.path.toLowerCase();
  if (intent === "FRAUD_DETECTION") return /(?:^|[\/_-])(fraud|risk|anomaly|assess)(?:$|[\/_-])/.test(path);
  if (intent === "URL_SCAN") return /(?:^|[\/_-])urls?(?:$|[\/_-])|urlscan/.test(path) || (/(?:^|[\/_-])(scan|check)(?:$|[\/_-])/.test(path) && /\burl\b/i.test(description));
  if (intent === "ONCHAIN_TX_LOOKUP") return /(?:^|[\/_-])(tx|transaction)(?:$|[\/_-])/.test(path) || /\b(?:transaction hash|on-chain transaction)\b/i.test(description);
  if (intent === "FACT_CHECK") return /(?:^|[\/_-])(fact|verify|proof)(?:$|[\/_-])/.test(path) || /\bfact[ -]?check\b/i.test(description);
  return /(?:^|[\/_-])(news|headlines)(?:$|[\/_-])/.test(path) || /\bnews (?:search|articles|headlines)\b/i.test(description);
}

export function compatibleEndpoints(miner: Miner, intent: DiscoveryIntent): Endpoint[] {
  return miner.endpoints
    .filter((endpoint) => endpointCompatible(endpoint, intent))
    .map((endpoint) => ({ ...endpoint, method: endpoint.method.toUpperCase() }))
    .sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method));
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
    const endpoint = compatibleEndpoints(winner.miner, intent)[0];
    return endpoint ? [{ ...winner, endpoint, schemaFamily: intent === "URL_SCAN" ? "declared-url" : intent === "ONCHAIN_TX_LOOKUP" ? "transaction-identifier" : "query-only" }] : [];
  });
}

export function selectMiner(registry: unknown, intent: DiscoveryIntent): Selection {
  const winner = eligibleSelections(registry, intent)[0];
  if (!winner) throw new Error(`No eligible miner for ${intent}`);
  return winner;
}

export function selectionExplanation(selection: Selection, intent: DiscoveryIntent): string {
  return `Selected because ${selection.miner.name} advertises ${intent} support and matched the Telegraph intent required for this evidence question (Rank #${selection.score.rank}).`;
}

