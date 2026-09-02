import { parseArgs } from "node:util";
import { buildRequest, TEST_IDS } from "./requests.js";
import { eligibleSelections, selectMiner } from "./selection.js";
import { DISCOVERY_INTENTS, PAID_INTENTS, type Intent, type Miner } from "./types.js";
import { inspectUnsignedChallenge } from "./transport.js";
import { publicChallengeMetadata } from "./challenge.js";
import { validateChallenge } from "./policy.js";
import { executeGuardedPaidCall, requireExecutionEnvironment, sanitizeForOutput } from "./payment-adapter.js";
import { RunLedger } from "./policy.js";

const { values } = parseArgs({ options: { "execute-paid": { type: "boolean", default: false }, "inspect-challenge": { type: "boolean", default: false }, "approved-asset": { type: "string" }, "logical-test-id": { type: "string" } } });
const nodeUrl = process.env.TELEGRAPH_NODE_URL ?? "http://13.237.89.59:7044";
const registryUrl = new URL("/miner-dispatcher/integrations", nodeUrl);

const response = await fetch(registryUrl, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`Free registry request failed with HTTP ${response.status}`);
const registry = await response.json() as Miner[];

if (values["execute-paid"] && values["inspect-challenge"]) throw new Error("Choose either --inspect-challenge or --execute-paid, not both");

if (values["inspect-challenge"]) {
  const logicalTestId = values["logical-test-id"];
  const intent = PAID_INTENTS.find((candidate) => TEST_IDS[candidate] === logicalTestId);
  if (!intent) throw new Error("--inspect-challenge requires a recognized --logical-test-id");
  const selection = selectMiner(registry, intent);
  const challenge = await inspectUnsignedChallenge(nodeUrl, selection, buildRequest(intent, selection.miner));
  console.log(JSON.stringify(publicChallengeMetadata(challenge), null, 2));
  validateChallenge(challenge, values["approved-asset"]);
  console.log("VALIDATED, THEN STOPPED: no signature, payment header, retry, or settlement was attempted.");
  process.exit(0);
}

if (values["execute-paid"]) {
  const logicalTestId = values["logical-test-id"];
  const intent = PAID_INTENTS.find((candidate) => TEST_IDS[candidate] === logicalTestId);
  if (!logicalTestId || !intent) throw new Error("--execute-paid requires a recognized --logical-test-id");
  const environment = requireExecutionEnvironment(process.env, values["approved-asset"]);
  const selection = selectMiner(registry, intent);
  const capture = await executeGuardedPaidCall({ nodeUrl, logicalTestId, intent: intent as Intent, selection, payload: buildRequest(intent, selection.miner), environment, ledger: new RunLedger() });
  console.log(sanitizeForOutput(capture));
  process.exit(capture.settlementOccurred ? 0 : 1);
}

console.log("Nexora Telegraph smoke harness — DRY RUN (payment disabled)");
console.log(`Free registry: ${registryUrl}`);
console.log(JSON.stringify({ registryTimestamp: new Date().toISOString(), totalRegistrations: registry.length, discovery: Object.fromEntries(DISCOVERY_INTENTS.map((intent) => { const eligible = eligibleSelections(registry, intent); return [intent, { eligibleCount: eligible.length, winner: eligible[0] ? { id: eligible[0].miner.id, name: eligible[0].miner.name, rank: eligible[0].score.rank } : null }]; })) }, null, 2));
for (const intent of PAID_INTENTS) {
  const selection = selectMiner(registry, intent);
  console.log(JSON.stringify({
    logicalTestId: TEST_IDS[intent], intent, minerId: selection.miner.id, minerName: selection.miner.name,
    rank: selection.score.rank, score: selection.score.score, advertisedPriceMicroUsdc: selection.miner.min_price_usdc,
    method: selection.endpoint.method, endpoint: selection.endpoint.path, schemaFamily: selection.schemaFamily,
    request: buildRequest(intent, selection.miner), mode: "DRY_RUN", paidInferenceCalls: 0, paymentSignatures: 0, settlements: 0,
  }, null, 2));
}
console.log("STOP: no miner endpoint was called and no payment was attempted.");
