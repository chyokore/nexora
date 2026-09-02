# Telegraph live contract compatibility matrix

Snapshot: 2026-09-02, Phase 2. Source: free `GET http://13.237.89.59:7044/miner-dispatcher/integrations`. **VERIFIED FROM LIVE REGISTRY.** No miner endpoint was called. `Active` below means registry activation only, not an end-to-end health result. Price is the registry's `min_price_usdc` in micro-USDC; 10,000 = $0.01 according to the official API documentation.

**Phase 3C registration correction:** the row for Sigvora 251 below is retained as an accurate record of what this historical dispatcher snapshot returned, but it must not be read as Sigvora's current registration. The project owner confirms that 251 is the deregistered historical registration and 315 is the current registration. A fresh Phase 3C dispatcher query still returned 251 as active and omitted 315, creating conflicting registry data; current 315 contract metadata and eligibility are therefore unverified. See the Phase 3C section of the runtime audit.

Notation: `?` means optional or not declared required. `schema missing` means the registry supplied `null`; no contract is inferred. For multi-capability miners, only the endpoint relevant to the stated intent is shown where its description makes that association clear.

## FRAUD_DETECTION — HETEROGENEOUS

| Miner | Relevant endpoint | Input contract | Output contract / signal mapping | Family | Price | Rank | Active |
|---|---|---|---|---|---:|---:|---|
| 10002 DegenLens | GET/POST `/anomaly/check` | `query` required; `address?`, `chain?`, `hours?`, `tx_hash?` | required `confidence`, `verdict`, `reasoning`, `data_source`; mapping confidence/reasoning | query + on-chain context | 10,000 | 4 | yes |
| 302 ChainSight | GET `/fraud` | `query?`, `address?`, `chain?`, `hash?`, other shared fields | loose `signal`, `source`, other cross-capability fields; mapping signal/source | loose query/on-chain | 10,000 | 3 | yes |
| 91001 SarzOps | POST `/fraud` | `query` required | required `signal`, `source`; mapping signal/source | query-only fraud research | 10,000 | 2 | yes |
| 9002 TxLens | POST `/fraud-query`, GET/POST `/assess-wallet` | large shared schema including `query?`, `wallet?`, `address?`, `chain?`, `tx_hash?` | loose union; includes answer/confidence/evidence/risk fields; mapping answer/confidence/summary | query or wallet | 10,000 | 5 | yes |
| 49 Anchor | GET `/risk-check` | `query?`, `wallet?` | required verdict/reasoning/confidence/meta; mapping same | wallet risk | 10,000 | 1 | yes |
| 204 IPLocate | GET `/api/lookup[/{ip}]` | `ip?` | IP/geolocation/privacy fields; mapping country/privacy | IP reputation | 10,000 | 9 | yes |
| 8421 TrustGate | GET `/fraud-detection` | `address` required; `chain?` | output schema missing; mapping confidence/verdict/summary | address risk | 10,000 | 12 | yes |
| 94217603 Sentinel | POST `/fraud-query`, GET/POST `/assess-wallet` | `query?`, `wallet?` | required mode/label/reason/confidence/assessment_status; mapping label/confidence/reason | query or wallet | 10,000 | 6 | yes |
| 95822412 Refut | POST `/assess` | `address` required; `chainId?` | required verdict/confidence/reasoning | address risk | 10,000 | 14 | yes |
| 232 EviPlan | POST `/verify`, `/verify-structured` | `action_type` required; evidence/policy/query/subject fields optional | gate_decision/confidence/evidence status/missing types/reason | structured action/evidence | 10,000 | 10 | yes |
| 221 EmailRep | GET `/{email}` | `email?` | email/reputation/suspicious/details/references | email reputation | 10,000 | 15 | yes |
| 402 AgentFeed | multiple market endpoints | input schema missing | output schema and signal mapping missing | crypto market risk | 10,000 | 11 | yes |
| 251 Sigvora | POST `/analyze` | input schema missing | output schema missing; mapping confidence/label/reason | undeclared | 10,000 | 8 | yes |
| 7777 Tele | POST `/fraud` | `dealId`, `threshold`, `counterparty` required; query/target fields optional | required verdict/confidence/reasoning/proof_hash/model | structured counterparty/deal | 10,000 | 7 | yes |
| 1001 Veridex | POST `/analyze` | `chain`, `contractAddress` required; `codeAddress?` | required schema/result/capabilityIntelligence; nested mapping | smart-contract capability risk | 10,000 | 13 | yes |

Largest request-compatible supplier-context subset: `{query: string}` can be represented in the declared properties of DegenLens, ChainSight, SarzOps, TxLens, Anchor, and Sentinel (6/15). Only DegenLens and SarzOps declare it required; the other four accept it in their schema but runtime sufficiency is **UNVERIFIED**. Their outputs are not uniform: there is no single top-level field present across all six. Registry `signal_mapping` provides a per-miner extraction guide, but mappings differ.

Conclusion: a useful query-oriented subset exists, but generic FRAUD_DETECTION across all miners is impossible from the registry contracts. A schema-qualified pool of six can remain provider-neutral; it requires per-contract response adapters and a paid conformance test before production use.

## URL_SCAN — HETEROGENEOUS, WORKABLE SUBSET

| Miner | Relevant endpoint | Input contract | Output contract / signal mapping | Family | Price | Rank | Active |
|---|---|---|---|---|---:|---:|---|
| 302 ChainSight | GET `/urlscan` | `query?` within shared schema; no `url` field | loose `signal`, `source`; mapping signal/source | query | 10,000 | 4 | yes |
| 152 Kriterion | POST `/scan` | input schema missing | rich research union; mapping answer/reason | undeclared/research | 10,000 | 10 | yes |
| 5001 URL Sentinel | POST `/scan` | `url` required | verdict/confidence/reason | URL verdict | 10,000 | 5 | yes |
| 20260828 Preflight | GET `/url-scan` | `url?`, `domain?` within shared schema | broad union including URL, verdict, confidence, reason, redirects/TLS | URL/infrastructure | 10,000 | 2 | yes |
| 7334 NetWire | GET `/url-scan` | `url?`, `question?` | reachability/TLS/status/summary/confidence | URL reachability | 10,000 | 1 | yes |
| 223 URLScan.io | POST `/scan`, GET `/result/{uuid}` | `url?`, `uuid?`, `visibility?` | api/page/result/uuid/verdicts | asynchronous scan/result | 10,000 | 8 | yes |
| 203 VirusTotal | domain/IP/file GET; URL POST | `url?`, `domain?`, `ip?`, `hash?` | provider-native `data` | threat intelligence | 10,000 | 6 | yes |
| 222 PhishTank | POST `/check` | `url?`, `format?` | in_database/verified/phish metadata | phishing lookup | 10,000 | 7 | yes |
| 11 URLhaus | POST `/check-url`, `/check-host` | input/output schemas missing | mapping threat/url_status | malware URL/host | 10,000 | 9 | yes |
| 7402 ProofGate | POST `/scan` | `url` required; `question?` | fully required verdict/malicious/confidence/reason/evidence metadata | URL verdict + evidence | 10,000 | 3 | yes |

Seven miners declare a `url` property: URL Sentinel, Preflight, NetWire, URLScan.io, VirusTotal, PhishTank, ProofGate. Minimal request `{url: string}` is schema-valid for the two that require it and representable for the other five; actual sufficiency for the optional-schema miners is **UNVERIFIED**. Four expose top-level confidence (URL Sentinel, Preflight, NetWire, ProofGate); three expose top-level verdict (URL Sentinel, Preflight, ProofGate). No response field is universal across all seven. Normalize into typed domain facts—malware/phishing verdict, reachability/TLS observations, provider-native findings—not one fabricated risk score.

## FACT_CHECK — HETEROGENEOUS

| Miner | Endpoint | Input contract | Output contract / signal mapping | Family | Price | Rank | Active |
|---|---|---|---|---|---:|---:|---|
| 4433 LiveCert | GET `/fact-check` | shared schema includes `query?`, `q?`, `text?`, `domain?` | broad union including claim/verdict/confidence/evidence/reason/source | textual claim | 10,000 | 2 | yes |
| 202 Tavily | POST `/search` or `/extract` | `query` required; search controls optional | answer/query/results/response_time | web search used as fact-check | 10,000 | 3 | yes |
| 717190 Qarinah | POST `/v1/proof` | `query` required; `intent?`, `as_of?`, `request_id?` | strict proof pack: verdict/confidence/evidence/conflict/coverage/abstention/hashes | claim proof pack | 10,000 | 1 | yes |
| 1188 Assay | POST `/miner.py` | input schema missing | output schema/mapping missing | undeclared | 10,000 | 4 | yes |

Minimal request `{query: string}` covers the three schema-declared miners. No response field is universal across those three: Qarinah and LiveCert share verdict/confidence/evidence/reason concepts; Tavily is a retrieval answer/results contract. FACT_CHECK therefore supports factual supplier claims only conditionally and cannot mean general “payment verification.”

## ONCHAIN_TX_LOOKUP — HETEROGENEOUS, FACTUAL SUBSETS

| Miner | Relevant endpoint | Input contract | Output contract / signal mapping | Family | Price | Rank | Active |
|---|---|---|---|---|---:|---:|---|
| 10002 DegenLens | GET/POST `/transaction/lookup` | `query` required; `tx_hash?`, `chain?` | status/parties/value/block/gas/fee/token transfers plus confidence/verdict | `tx_hash` + query | 10,000 | 5 | yes |
| 302 ChainSight | GET `/tx` | `hash?`, `chain?`, `query?` | loose signal/source/value union | `hash` | 10,000 | 2 | yes |
| 9002 TxLens | GET `/check-tx` | `tx_hash?`, `chain?`, `query?` in shared schema | broad union including receipt status/block/parties/value/confidence | `tx_hash` | 10,000 | 4 | yes |
| 900 OnChain Intel | GET `/tx` or `/ask` | `hash?`, `chain?`, `query?` | required ok/intent/signal/confidence/sources/data | `hash` | 10,000 | 7 | yes |
| 20260828 Preflight | GET `/tx-lookup` | `hash?`, `chain?` in shared schema | broad union including status/block/parties/value/fee/confidence | `hash` | 10,000 | 8 | yes |
| 9001 Verity | GET `/lookup` | one of `tx_hash`, `hash`, `txHash`, `query`, `question`; `chain?` | required chain/hash/status/confidence/answer/canonical/summary | aliases | 10,000 | 11 | yes |
| 9005 Veyctum | GET `/lookup` | `tx_hash` required; `chain?`, `format?` | answer required; state/status/finality/effects/evidence/error details | `tx_hash` | 10,000 | 1 | yes |
| 9010 Sigil | GET `/lookup` | `chain` and `tx_hash` required | required chain/hash/status/canonical/confidence/summary; effects/evidence/finality | `tx_hash` | 10,000 | 12 | yes |
| 8453 Truvian | GET `/tx` | `hash?`, `chain?`, `query?` | answer/signal/source/confidence/block/gas/fee | `hash` | 10,000 | 9 | yes |
| 9007 Interlock | POST `/miner/onchain-tx-lookup` | `chainId` and `txHash` required | strict existence/lifecycle/status/confirmations/parties/value/gas/transfers/logs/evidence scope | camelCase | 10,000 | 3 | yes |
| 7307 ChainWire | GET `/tx` | `hash?`, `chain?` | status/block/confirmations/parties/value/fee/confidence/summary | `hash` | 10,000 | 6 | yes |
| 10001 VulnFeed | POST `/v1/analyze` | `address` required; `chain_id?`, `rpc_url?` | contract vulnerability rating/findings/risk | contract address, not transaction | 100,000 | 10 | yes |

No universal transaction request exists. `{chain, hash}` is representable for ChainSight, OnChain Intel, Preflight, Verity, Truvian, and ChainWire (6), but none of the five non-Verity schemas declares hash required, so runtime sufficiency is **UNVERIFIED**. `{chain, tx_hash}` is representable for DegenLens, TxLens, Verity, Veyctum, and Sigil (5), but DegenLens additionally requires `query`. Interlock uses `chainId`/`txHash`. VulnFeed is semantically a contract analyzer despite advertising this intent and must not enter a transaction-lookup pool.

Most transaction-family outputs provide factual transaction state, not fraud conclusions. Common concepts within useful subsets include identifier, chain, status/existence/finality, block/confirmations, parties, value, fees/gas, and summary; exact field names and guarantees vary. Pending support is declared by DegenLens and lifecycle/finality-oriented miners, but live behavior is **UNVERIFIED**.

## Compatibility classification summary

| Intent | Classification | Largest useful request family | Uniform response? | Generic adapter verdict |
|---|---|---|---|---|
| FRAUD_DETECTION | HETEROGENEOUS | query-oriented, 6/15 | no | request subset plus miner-specific output adapters only |
| URL_SCAN | HETEROGENEOUS | `url`, 7/10 | no | viable core with schema-qualified subset and typed adapters |
| FACT_CHECK | HETEROGENEOUS | `query`, 3/4 | no | conditional claim-checking only |
| ONCHAIN_TX_LOOKUP | HETEROGENEOUS | `hash` 6/12 or `tx_hash` 5/12 | no | viable conditional factual domain with alias adapters |

No inspected intent has one universal wire contract. `supported_intents` is routing/scoring metadata, not a guarantee of identical request or response schemas.
