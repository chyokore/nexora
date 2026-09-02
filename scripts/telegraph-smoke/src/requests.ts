import type { Intent, Miner } from "./types.js";

const PUBLIC_TX = "0xcd9a4af2f822034bf8b8437815c17d3f2ae56bbee8d7444b3c12093525da1882";

export const TEST_IDS: Record<Intent, string> = {
  FRAUD_DETECTION: "fraud-smoke-001",
  URL_SCAN: "url-smoke-001",
  ONCHAIN_TX_LOOKUP: "onchain-smoke-001",
};

export function buildRequest(intent: Intent, miner: Miner): Record<string, string | number> {
  const properties = miner.input_schema?.properties ?? {};
  if (intent === "FRAUD_DETECTION") {
    if (!("query" in properties)) throw new Error("Selected fraud schema does not accept query");
    return { query: "Assess risk indicators in a routine supplier payment request where beneficiary details changed and independent confirmation is still pending. State missing evidence explicitly." };
  }
  if (intent === "URL_SCAN") {
    if (!("url" in properties)) throw new Error("Selected URL schema does not accept url");
    return { url: "https://example.com/" };
  }

  const request: Record<string, string | number> = {};
  if ("tx_hash" in properties) request.tx_hash = PUBLIC_TX;
  else if ("hash" in properties) request.hash = PUBLIC_TX;
  else if ("txHash" in properties) request.txHash = PUBLIC_TX;
  else throw new Error("Selected on-chain schema lacks a transaction identifier");
  if ("chain" in properties) {
    const allowed = properties.chain?.enum;
    const supported = ["base", "base-sepolia", "Base Sepolia"].find((value) => !allowed || allowed.includes(value));
    if (!supported) throw new Error("Selected on-chain schema does not support Base Sepolia");
    request.chain = supported;
  }
  if ("chainId" in properties) request.chainId = 84532;
  if ((miner.input_schema?.required ?? []).includes("query")) request.query = `Look up Base Sepolia transaction ${PUBLIC_TX}`;
  return request;
}
