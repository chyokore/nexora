import { parseChallenge } from "./challenge.js";
import type { PaymentChallenge, Selection } from "./types.js";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function buildMinerRequest(nodeUrl: string, selection: Selection, payload: Record<string, string | number>): { url: URL; init: RequestInit } {
  const url = new URL(`/miner-dispatcher/v1/${encodeURIComponent(selection.miner.id)}${selection.endpoint.path}`, nodeUrl);
  const init: RequestInit = { method: selection.endpoint.method, redirect: "manual", headers: { accept: "application/json" } };
  if (selection.endpoint.method === "GET") for (const [key, value] of Object.entries(payload)) url.searchParams.set(key, String(value));
  else { (init.headers as Record<string, string>)["content-type"] = "application/json"; init.body = JSON.stringify(payload); }
  return { url, init };
}

export async function inspectUnsignedChallenge(
  nodeUrl: string,
  selection: Selection,
  payload: Record<string, string | number>,
  fetchImpl: FetchLike = fetch,
): Promise<PaymentChallenge> {
  const { url, init } = buildMinerRequest(nodeUrl, selection, payload);

  const response = await fetchImpl(url, init);
  if (response.status >= 300 && response.status < 400) throw new Error("Unexpected redirect before payment");
  if (response.url && new URL(response.url).origin !== url.origin) throw new Error("Unexpected payment target substitution");
  if (response.status !== 402) throw new Error(`Expected an unsigned HTTP 402 challenge; received ${response.status}. No retry was attempted.`);
  const header = response.headers.get("payment-required");
  if (header) return parseChallenge(header);
  return parseChallenge(await response.json());
}
