# Live Telegraph smoke evidence

## Phase 5A: unsigned FRAUD_DETECTION preflight

Timestamp: `2026-09-02T19:31:44.255Z`

- **VERIFIED LIVE:** The free dispatcher returned 129 registrations and 6 neutrally eligible FRAUD_DETECTION miners.
- **VERIFIED LIVE:** Neutral selection chose DegenLens On-Chain Intelligence, miner `10002`, rank 1, score 1, advertised price 10,000 micro-units, using `GET /transaction/lookup` with the query-only input contract.
- **VERIFIED FROM RESPONSE:** Logical call `fraud-smoke-001` received HTTP 402 with x402 version 2, scheme `exact`, network `eip155:84532`, asset `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, amount `10000`, and payee `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8`.
- **UNAVAILABLE:** The challenge did not expose a validity/expiry, resource, or description through the parsed response fields.
- **VERIFIED FROM RESPONSE:** The challenge passed validation-only scheme, network, address, amount, payee, miner, logical-ID, and redirect/target checks. Treating the observed asset as validation input did not approve it for signing.
- **VERIFIED FROM BASE SEPOLIA:** Chain ID 84532; challenge asset contract bytecode exists (1,798 bytes); token metadata is name `USDC`, symbol `USDC`, decimals 6.
- **VERIFIED FROM BASE SEPOLIA:** Burner `0x63D00Cfa1f73765bF94013294278E429868803eC` has 0 ETH and 0 USDC. The 0.01 USDC challenge amount is therefore **INSUFFICIENT**.
- **VERIFIED LIVE:** Payment signatures 0; paid retries 0; settlements 0; blockchain writes 0.

Execution stopped before authorization. The challenge asset has not been approved.

## Phase 5B.1: endpoint-intent correction

- **VERIFIED LIVE:** At `2026-09-02T19:49:42.841Z`, the dispatcher returned 129 registrations and 15 FRAUD_DETECTION miners. Fifteen individual endpoints had explicit or narrow intent-compatible evidence; 6 miners had satisfiable supplier-query schemas; 6 remained finally eligible.
- **VERIFIED LIVE:** Neutral rank/score still selected DegenLens miner `10002`, but now selected `GET /anomaly/check`, whose description explicitly declares `FRAUD_DETECTION`.
- **VERIFIED LIVE:** DegenLens `GET` and `POST /transaction/lookup` were rejected for FRAUD_DETECTION because their descriptions explicitly declare `ONCHAIN_TX_LOOKUP`; `GET` and `POST /anomaly/check` were independently accepted.
- **INFERRED AND TESTED LOCALLY:** Endpoint `path`, `method`, and optional `description` are the only endpoint-level registry fields observed. Nexora treats miner intent eligibility, endpoint intent association, and shared-schema satisfiability as separate gates. No miner endpoint, x402 challenge, signature, settlement, or blockchain write occurred in this correction phase.

## Phase 5B: single live FRAUD_DETECTION purchase

Timestamp: `2026-09-02T20:27:27.873Z`

- **VERIFIED LIVE:** Fresh discovery returned 129 registrations, 15 FRAUD_DETECTION miners, 15 endpoint-compatible endpoint candidates, 6 schema-compatible miners, and 6 finally eligible miners. Neutral selection chose DegenLens miner `10002`, rank 1, score 1, using `GET /anomaly/check`; the endpoint explicitly declares FRAUD_DETECTION and requires only `query`.
- **VERIFIED LIVE:** Logical call `fraud-smoke-001` completed HTTP negotiation `[402, 402, 200]` using x402 v2, scheme `exact`, network `eip155:84532`, asset `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, amount 10,000 base units (0.01 USDC), and payee `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8`. Settlement metadata reported success.
- **VERIFIED FROM BASE SEPOLIA:** Transaction `0x1a26240e0580a454cfacf8bb15dca9c5b99e0aada13757b53d6551f1ad86c2ff` transferred 10,000 USDC base units from the burner to the challenge payee in block 46,306,281. Burner balance changed from 20.00 to 19.99 USDC.
- **SUPPLIED BY MINER:** HTTP 200 JSON object with `verdict: out_of_coverage`, `risk_tier: insufficient_data`, `confidence: 0`, `coverage_complete: false`, `data_source: unavailable`, and a rationale explaining that no supported on-chain address or reviewed named case was supplied. The miner did not guess.
- **NORMALIZED:** `FraudEvidence` preserves label `out_of_coverage`, confidence 0, the supplied rationale, and uncertainty markers `coverage_incomplete`, `data_source_unavailable`, and `insufficient_data`. Response schema classification: `MATCH`.
- **UNAVAILABLE:** No positive fraud classification or supported factual risk signal was returned for the off-chain synthetic scenario. No such claim is inferred.
- **VERIFIED LIVE:** Exactly 1 logical paid operation, 1 paid retry, 1 authorization flow, 1 settlement, 0 direct Nexora blockchain writes, and 0.01 USDC reportable cost. Execution stopped after Call 1.

## Phase 5C: single live URL_SCAN purchase

Timestamp: `2026-09-02T20:38:12.635Z`

- **VERIFIED LIVE:** Fresh discovery returned 129 registrations, 10 URL_SCAN miners, 11 endpoint-compatible endpoint candidates, 7 schema-compatible miners, and 7 finally eligible miners. Neutral selection chose NetWire URL Scan miner `7334`, rank 1, score `0.9499101`, using `GET /url-scan`; the endpoint description and `url` property support the exact harmless input `https://example.com/`.
- **VERIFIED LIVE:** Logical call `url-smoke-001` completed HTTP negotiation `[402, 402, 200]` on `eip155:84532` with the approved USDC asset, amount 10,000 base units, and payee `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8`. Settlement metadata reported success.
- **VERIFIED FROM BASE SEPOLIA:** Transaction `0xcd9a4af2f822034bf8b8437815c17d3f2ae56bbee8d7444b3c12093525da1882` transferred 10,000 USDC base units to the challenge payee in block 46,306,603. Burner balance changed from 19.99 to 19.98 USDC.
- **SUPPLIED BY MINER:** HTTP 200 JSON object reported the exact URL reachable over valid HTTPS/TLS with status 200, `safe: true`, `risk: low`, `risk_score: 0.1`, confidence `0.93`, empty URLhaus/OpenPhish listings, and explicit source/attribution metadata.
- **NORMALIZED:** `UrlSafetyEvidence` preserves the queried URL, supplied low-risk verdict, safe flag, confidence, reachability, risk score, empty threat-indicator result, checked feeds, scan status, and summary. Response schema classification: `MATCH`.
- **INFERRED:** Empty checked-feed listings mean those providers supplied no listing evidence at scan time; they are not a universal guarantee that the URL will remain safe.
- **UNAVAILABLE:** No provider-independent guarantee, future-state assurance, or broader threat-feed coverage was supplied.
- **VERIFIED LIVE:** Exactly 1 logical paid operation, 1 paid retry, 1 authorization flow, 1 settlement, 0 direct Nexora blockchain writes, and 0.01 USDC reportable cost. Execution stopped after URL_SCAN.

## Phase 5D: single live ONCHAIN_TX_LOOKUP purchase

Timestamp: `2026-09-02T20:56:30.757Z`

- **VERIFIED BASE SEPOLIA:** Before purchase, transaction `0xcd9a4af2f822034bf8b8437815c17d3f2ae56bbee8d7444b3c12093525da1882` existed on chain 84532 at block 46,306,603, block hash `0xb44e2d6f1cd8abe581fb94717846a4e58f55fd3992e5f3ea6620bbaa7549c384`, index 22, from `0xc6699d2aada6c36dfea5c248dd70f9cb0235cb63` to `0xca11bde05977b3631167028862be2a173976ca11`, native value 0, with 612 calldata bytes, successful receipt, 92,348 gas used, effective gas price 7,000,000, and 2 logs.
- **VERIFIED LIVE TELEGRAPH:** Fresh discovery returned 129 registrations, 12 ONCHAIN_TX_LOOKUP miners, 9 endpoint-compatible endpoint candidates, 11 schema-compatible miners, and 8 finally eligible miners. Neutral selection chose TxLens miner `9002`, rank 1, score `0.014715711`, using `GET /check-tx`. The request used the real hash and schema-enumerated `chain=base`.
- **VERIFIED LIVE TELEGRAPH:** Negotiation was `[402, 402, 200]`: guard preflight unsigned challenge, x402 client unsigned negotiation, then authorized retry. The authoritative challenge explicitly supplied x402 version 2, scheme `exact`, network `eip155:84532`, approved USDC asset, amount 10,000 base units, and the validated payee. Settlement metadata reported success.
- **VERIFIED BASE SEPOLIA:** Settlement transaction `0x173cd26ca347faf6de0a35ab310d8e7254515e25f9d3a40c35934e2dcc9ef5e9` transferred 10,000 USDC base units to the payee in block 46,307,152. Burner balance changed from 19.98 to 19.97 USDC.
- **SUPPLIED BY MINER:** HTTP 200 schema-matching JSON echoed the queried hash and `chain: base` but returned `status: not_found`, confidence 1, and no block, parties, value, receipt status, or decoded method.
- **CONTRADICTED:** Miner `not_found` conflicts with the independently verified successful Base Sepolia transaction. Hash and chain match; receipt/existence status mismatches; block, from, to, value, and receipt fields are unavailable from the miner response.
- **NORMALIZED:** `OnchainTransactionEvidence` preserves the exact queried hash, chain, miner status, confidence, missing fields, and `transaction_not_found_by_miner` uncertainty. No fraud, suspiciousness, or Nexora decision is inferred. Response schema classification: `MATCH`.
- **VERIFIED LIVE TELEGRAPH:** Exactly 1 logical paid operation, 1 paid retry, 1 authorization flow, 1 settlement, 0 direct Nexora blockchain writes, and 0.01 USDC reportable cost. Execution stopped after ONCHAIN_TX_LOOKUP.
