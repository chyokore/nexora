import { parseArgs } from "node:util";
import { buildRequest, TEST_IDS } from "./requests.js";
import { selectMiner } from "./selection.js";
import { INTENTS, type Miner } from "./types.js";
import { inspectUnsignedChallenge } from "./transport.js";
import { publicChallengeMetadata } from "./challenge.js";
import { validateChallenge } from "./policy.js";

const { values } = parseArgs({ options: { "allow-payment": { type: "boolean", default: false }, "inspect-challenge": { type: "boolean", default: false }, "approved-asset": { type: "string" }, "logical-test-id": { type: "string" } } });
const nodeUrl = process.env.TELEGRAPH_NODE_URL ?? "http://13.237.89.59:7044";
const registryUrl = new URL("/miner-dispatcher/integrations", nodeUrl);

const response = await fetch(registryUrl, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`Free registry request failed with HTTP ${response.status}`);
const registry = await response.json() as Miner[];

if (values["allow-payment"] && values["inspect-challenge"]) throw new Error("Choose either --inspect-challenge or --allow-payment, not both");

if (values["inspect-challenge"]) {
  const logicalTestId = values["logical-test-id"];
  const intent = INTENTS.find((candidate) => TEST_IDS[candidate] === logicalTestId);
  if (!intent) throw new Error("--inspect-challenge requires a recognized --logical-test-id");
  const selection = selectMiner(registry, intent);
  const challenge = await inspectUnsignedChallenge(nodeUrl, selection, buildRequest(intent, selection.miner));
  console.log(JSON.stringify(publicChallengeMetadata(challenge), null, 2));
  validateChallenge(challenge, values["approved-asset"]);
  console.log("VALIDATED, THEN STOPPED: no signature, payment header, retry, or settlement was attempted.");
  process.exit(0);
}

if (values["allow-payment"]) {
  const logicalTestId = values["logical-test-id"];
  const intent = INTENTS.find((candidate) => TEST_IDS[candidate] === logicalTestId);
  if (!intent) throw new Error("--allow-payment requires a recognized --logical-test-id");
  if (!values["approved-asset"] || !/^0x[a-fA-F0-9]{40}$/.test(values["approved-asset"])) throw new Error("--allow-payment requires a valid, explicitly approved --approved-asset");
  if (!/^0x[a-fA-F0-9]{64}$/.test(process.env.TELEGRAPH_EVM_PRIVATE_KEY ?? "")) throw new Error("--allow-payment requires a valid TELEGRAPH_EVM_PRIVATE_KEY in the local process environment");
  if ((process.env.EVM_NETWORK ?? "eip155:84532") !== "eip155:84532") throw new Error("Payment mode requires EVM_NETWORK=eip155:84532");
  selectMiner(registry, intent);
  throw new Error("PAYMENT_EXECUTOR_NOT_INSTALLED: prerequisites checked, but Phase 3B cannot contact a miner, sign, or pay");
}

console.log("Nexora Telegraph smoke harness — DRY RUN (payment disabled)");
console.log(`Free registry: ${registryUrl}`);
for (const intent of INTENTS) {
  const selection = selectMiner(registry, intent);
  console.log(JSON.stringify({
    logicalTestId: TEST_IDS[intent], intent, minerId: selection.miner.id, minerName: selection.miner.name,
    rank: selection.score.rank, score: selection.score.score, advertisedPriceMicroUsdc: selection.miner.min_price_usdc,
    method: selection.endpoint.method, endpoint: selection.endpoint.path, schemaFamily: selection.schemaFamily,
    request: buildRequest(intent, selection.miner), mode: "DRY_RUN", paidInferenceCalls: 0, paymentSignatures: 0, settlements: 0,
  }, null, 2));
}
console.log("STOP: no miner endpoint was called and no payment was attempted.");
