import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMinerCapability, outputCapable, selectMiner, eligibleSelections } from "../src/selection.js";
import type { Miner, Intent } from "../src/types.js";

function makeMiner(id: string, name: string, rank: number, intent: Intent, inputProps: string[], outputProps: Record<string, unknown> | null): Miner {
  return {
    id,
    name,
    activation_status: "active",
    min_price_usdc: 10000,
    supported_intents: [intent],
    endpoints: [{ method: "GET", path: "/lookup", description: `${intent}. Test endpoint.` }],
    input_schema: { properties: Object.fromEntries(inputProps.map((k) => [k, { type: "string" }])) },
    output_schema: outputProps ? { properties: outputProps } : (null as any),
    scores: [{ intent_id: intent, rank, score: 0.9 }],
  };
}

test("highest-ranked capable miner wins while higher-ranked incapable miner is skipped", () => {
  const incapableRank1 = makeMiner("302", "ChainSight", 1, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { signal: { type: "string" }, value_eth: { type: "number" } });
  const capableRank2 = makeMiner("7307", "ChainWire", 2, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { status: { type: "string" }, block_number: { type: "number" } });

  const winner = selectMiner([incapableRank1, capableRank2], "ONCHAIN_TX_LOOKUP");
  assert.strictEqual(winner.miner.id, "7307", "Capable Rank 2 miner must win over incapable Rank 1 miner");
});

test("Telegraph rank ordering is preserved among capable miners", () => {
  const capableRank2 = makeMiner("7307", "ChainWire", 2, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { status: { type: "string" } });
  const capableRank3 = makeMiner("9007", "INTERLOCK", 3, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { status: { type: "string" } });

  const winner = selectMiner([capableRank3, capableRank2], "ONCHAIN_TX_LOOKUP");
  assert.strictEqual(winner.miner.id, "7307", "Telegraph rank ordering (#2 over #3) must be preserved among capable miners");
});

test("provider names and IDs do not affect capability classification", () => {
  const namedChainWireIncapable = makeMiner("7307", "ChainWire Transaction Lookup", 1, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { signal: { type: "string" } });
  const namedOtherCapable = makeMiner("9999", "Random Miner", 2, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { status: { type: "string" } });

  assert.strictEqual(outputCapable(namedChainWireIncapable, "ONCHAIN_TX_LOOKUP"), false);
  const winner = selectMiner([namedChainWireIncapable, namedOtherCapable], "ONCHAIN_TX_LOOKUP");
  assert.strictEqual(winner.miner.id, "9999");
});

test("generic 'signal' does NOT satisfy ONCHAIN_TX_LOOKUP status requirement", () => {
  const minerWithSignal = makeMiner("100", "SignalMiner", 1, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { signal: { type: "string" } });
  assert.strictEqual(outputCapable(minerWithSignal, "ONCHAIN_TX_LOOKUP"), false);
  const check = checkMinerCapability(minerWithSignal, "ONCHAIN_TX_LOOKUP");
  assert.strictEqual(check.capable, false);
  assert.strictEqual(check.reason, "OUTPUT_SCHEMA_CANNOT_SATISFY_EVIDENCE_REQUIREMENT");
});

test("generic 'value' does NOT satisfy ONCHAIN_TX_LOOKUP status requirement", () => {
  const minerWithValue = makeMiner("101", "ValueMiner", 1, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { value: { type: "string" } });
  assert.strictEqual(outputCapable(minerWithValue, "ONCHAIN_TX_LOOKUP"), false);
});

test("'status' does satisfy current ONCHAIN_TX_LOOKUP capability requirement", () => {
  const minerWithStatus = makeMiner("102", "StatusMiner", 1, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { status: { type: "string" } });
  assert.strictEqual(outputCapable(minerWithStatus, "ONCHAIN_TX_LOOKUP"), true);
  const check = checkMinerCapability(minerWithStatus, "ONCHAIN_TX_LOOKUP");
  assert.strictEqual(check.capable, true);
});

test("unknown or loose output schema does not trigger paid selection", () => {
  const minerNullSchema = makeMiner("103", "NullSchemaMiner", 1, "ONCHAIN_TX_LOOKUP", ["tx_hash"], null);
  const minerEmptySchema = makeMiner("104", "EmptySchemaMiner", 2, "ONCHAIN_TX_LOOKUP", ["tx_hash"], {});

  assert.strictEqual(outputCapable(minerNullSchema, "ONCHAIN_TX_LOOKUP"), false);
  assert.strictEqual(outputCapable(minerEmptySchema, "ONCHAIN_TX_LOOKUP"), false);
  assert.strictEqual(eligibleSelections([minerNullSchema, minerEmptySchema], "ONCHAIN_TX_LOOKUP").length, 0);
});

test("no-capable-miner condition fails safely", () => {
  const incapable1 = makeMiner("302", "ChainSight", 1, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { signal: { type: "string" } });
  const incapable2 = makeMiner("8453", "Truvian", 2, "ONCHAIN_TX_LOOKUP", ["tx_hash"], { answer: { type: "string" } });

  assert.strictEqual(eligibleSelections([incapable1, incapable2], "ONCHAIN_TX_LOOKUP").length, 0);
  assert.throws(() => selectMiner([incapable1, incapable2], "ONCHAIN_TX_LOOKUP"), /No eligible miner/);
});

test("existing input and endpoint compatibility checks still apply", () => {
  // Has output status, but lacks valid tx_hash/hash/txHash input property
  const invalidInputMiner = makeMiner("105", "BadInputMiner", 1, "ONCHAIN_TX_LOOKUP", ["query_only"], { status: { type: "string" } });
  assert.strictEqual(eligibleSelections([invalidInputMiner], "ONCHAIN_TX_LOOKUP").length, 0);
});
