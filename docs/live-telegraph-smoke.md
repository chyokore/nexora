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
