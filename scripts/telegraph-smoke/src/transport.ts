import { parseChallenge } from "./challenge.js";
import type { PaymentChallenge, Selection } from "./types.js";

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export async function inspectUnsignedChallenge(
  nodeUrl: string,
  selection: Selection,
  payload: Record<string, string | number>,
  fetchImpl: FetchLike = fetch,
): Promise<PaymentChallenge> {
  const url = new URL(`/miner-dispatcher/v1/${encodeURIComponent(selection.miner.id)}${selection.endpoint.path}`, nodeUrl);
  const init: RequestInit = { method: selection.endpoint.method, headers: { accept: "application/json" } };
  if (selection.endpoint.method === "GET") {
    for (const [key, value] of Object.entries(payload)) url.searchParams.set(key, String(value));
  } else {
    (init.headers as Record<string, string>)["content-type"] = "application/json";
    init.body = JSON.stringify(payload);
  }

  const response = await fetchImpl(url, init);
  if (response.status !== 402) throw new Error(`Expected an unsigned HTTP 402 challenge; received ${response.status}. No retry was attempted.`);
  const header = response.headers.get("payment-required");
  if (header) return parseChallenge(header);
  return parseChallenge(await response.json());
}
