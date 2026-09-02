# Telegraph runtime audit for Nexora

Audit timestamp: 2026-09-02 (Africa/Lagos). Scope: discovery only; no inference calls, payments, application scaffolding, or miner-target traffic.

## Evidence labels

- **LIVE** — observed from a free Telegraph runtime endpoint during this audit.
- **OFFICIAL** — stated in Telegraph-controlled documentation or source.
- **INFERRED** — engineering conclusion from the preceding evidence.
- **UNVERIFIED** — not established without a paid call, unavailable documentation, or operator confirmation.

## 1. Environment inspected

**LIVE:** The Nexora working directory was empty apart from Git metadata before this report. No `TELEGRAPH_*`, `X402`, wallet, Base, or CDP-named environment variables were present (names only were inspected; no secret values were printed). The live node registry was reachable over HTTP. `GET http://13.237.89.59:8080/health` returned HTTP 200 with `{"status":"ok","miner":"telegraph-chatbot"}`. Guessed node paths `/health` and `/telehealth`, and engine `/subnets`, returned 404; they are therefore not valid HTTP contracts at those paths.

Sources inspected: [official docs](https://docs.telegraphprotocol.com/), [official MCP repository](https://github.com/telegraphprotocol/telegraph-mcp), [MCP README](https://github.com/telegraphprotocol/telegraph-mcp/blob/main/README.md), [MCP architecture](https://github.com/telegraphprotocol/telegraph-mcp/blob/main/docs/architecture.md), [hackathon rules](https://hackathon.telegraphprotocol.com/rules), [developer console](https://integrate.telegraphprotocol.com/), [explorer](https://explorer.telegraphprotocol.com/), and the free live registry described below.

## 2. Official Telegraph integration paths discovered

**OFFICIAL:**

1. Telegraph MCP (`telegraph-protocol-mcp`, JSON-RPC over stdio) wraps discovery, Engine calls, dynamic miner tools, and x402 signing. It is the easiest agent integration, but its generic `tg_engine_ask` uses an LLM router.
2. Engine HTTP API at the configured engine URL: `GET /v1/subnets` (free), `POST /v1/ask` with `{query}` (paid, LLM-routed), and `POST /v1/ask/{subnet_id}` with `{method, endpoint, payload}` (paid, explicit miner).
3. Node dispatcher HTTP API: free `GET /miner-dispatcher/integrations`; paid calls are constructed as `/miner-dispatcher/v1/{miner_id}{endpoint_path}` with GET query parameters or a JSON body.
4. Dynamic MCP miner tools are generated from the node registry at startup and refreshed every five minutes.
5. Daemon/explorer tools exist for signals and category data, but they are not the primary decision-time intent route established by the inspected source.

**UNVERIFIED:** A separate public WebSocket SDK is advertised by the developer console, but an exact, current client contract was not recoverable in this audit. Do not build against it yet.

## 3. Live miner registry/discovery mechanism

**LIVE:** The authoritative runtime catalog is:

```text
GET http://13.237.89.59:7044/miner-dispatcher/integrations
```

It returned 129 registrations. Each record can contain `id`, `slug`, `name`, `description`, endpoints, JSON input/output schemas, signal mapping, supported intents, base/YAML URLs, activation status, minimum price, request count, scoring status, scores/ranks, and timestamps. The official MCP uses this endpoint and refreshes tools every 300,000 ms.

**Important:** `activation_status: active`, `scored: true`, and a recent `last_scored_at` prove registry/ranking presence, not end-to-end availability at decision time. Discovery should be snapshotted into replay records, and each paid result must still be validated.

At audit time the candidate pool sizes were: FRAUD_DETECTION 15, URL_SCAN 10, ONCHAIN_TX_LOOKUP 12, NEWS_SEARCH 5, FACT_CHECK 4. Every listed candidate had `activation_status: active`, `scored: true`, and a score timestamp on 2026-09-02. Prices were 10,000 registry units for all representative miners and nearly all candidates; registry semantics plus official “typically $0.01” guidance indicate six-decimal USDC base units (**INFERRED**). VulnFeed advertised 100,000 units.

## 4. Candidate intent results

### FRAUD_DETECTION — PASS

**LIVE:** 15 compatible active/scored miners. Representative miner `91001`, `sarzops-transaction-risk`, exposes `POST /fraud`; required `{query: string}`; output requires `{signal: string, source: string}`. Other materially structured options include DegenLens (`10002`) with risk score/tier/signals and Tele (`7777`) with verdict/confidence/reasoning/proof hash.

**Caveat:** FRAUD_DETECTION is semantically broad. Some miners assess historical scams, some wallets, some contracts, and some counterparties. Intent compatibility alone does not make responses comparable. Nexora must constrain the proposed-action evidence request and validate a supported response profile.

### URL_SCAN — PASS

**LIVE:** 10 compatible active/scored miners. Representative miner `5001`, `url-sentinel`, exposes `POST /scan`; required `{url: string}`; output declares `verdict` (`safe`, `suspicious`, `malicious`, or `unknown`), `confidence` (0–1), and `reason`. This is directly machine-readable for policy.

### ONCHAIN_TX_LOOKUP — PASS

**LIVE:** 12 compatible active/scored miners. Representative miner `9001`, `verity-onchain-lookup`, exposes `GET /lookup`; accepts one of `tx_hash`, `hash`, `txHash`, `query`, or `question`, plus optional chain from Ethereum/Base/Arbitrum/Optimism/Polygon. Output requires chain, chain ID, hash, status, confidence, answer, canonical, and summary, and may include block, parties, value, fee, gas, selector, and transaction type. This is the strongest deterministic evidence domain.

### NEWS_SEARCH — PASS

**LIVE:** 5 compatible active/scored miners. Representative miner `9004`, `verity-news-search`, exposes `GET /news`; requires `q`, `query`, or `question`; optional category/country/language/date/domain/result-count filters. Output requires normalized articles (title, URL, publication time, source, description), confidence, answer, canonical, and summary. It is machine-readable, but relevance to payment authorization depends on a concrete supplier/event query.

### FACT_CHECK — PASS

**LIVE:** 4 compatible active/scored miners. Representative miner `717190`, `qarinah-proofpack`, exposes `POST /v1/proof`; requires `query`, with optional explicit `intent: FACT_CHECK`, `as_of`, and `request_id`. It declares the richest policy-ready result: bounded verdict (`SUPPORTED`, `REFUTED`, `MIXED`, `INSUFFICIENT_EVIDENCE`), confidence, coverage, freshness, conflict, claims, source evidence and hashes, contradictions, abstention, and verification metadata.

**Caveat:** The registry schema is strong, but actual output conformance and source independence remain **UNVERIFIED** until a legitimate paid test is authorized.

## 5. Exact request/response contracts discovered

The representative contracts above are **LIVE registry declarations**, not observed inference responses. Exact dispatcher envelope:

```text
GET  {NODE}/miner-dispatcher/v1/{miner_id}{path}?field=value
POST {NODE}/miner-dispatcher/v1/{miner_id}{path}
Content-Type: application/json
Accept: application/json
body: miner input object
```

The MCP applies any declared `param_map`, uses declared content type/multipart fields, expects a 2xx response parseable as JSON, and otherwise throws an error containing status/body. The full field-level schemas are available in the runtime registry and should be cached by hash per decision; they must not be copied permanently as timeless truth.

No real response examples were collected because that would have required paid miner traffic. Consequently, output-schema conformance, unknown-field behavior, and runtime error bodies remain **UNVERIFIED**.

## 6. Routing behavior

**OFFICIAL:** Hackathon rules describe intent declaration plus confidence/deadline and probabilistic routing among ranked miners. **However**, the inspected current MCP exposes only:

- `tg_engine_ask`: natural-language `{query}`; an LLM chooses a miner.
- `tg_engine_ask_subnet`: explicit `subnet_id`, method, endpoint, and payload.
- dynamic miner tools: explicit miner/endpoints discovered from the registry.

**Material mismatch:** No inspected current HTTP/MCP request contract exposed a deterministic “intent = X, let Telegraph probabilistically choose a compatible miner” call with confidence/deadline fields. Therefore:

- Nexora can explicitly request a known *miner*, not a known intent through the proven Engine contract.
- Compatible miners can be discovered without hardcoding via the registry.
- LLM inference can be avoided by using dispatcher/dynamic/direct calls, but that also bypasses demonstrated intent-level probabilistic selection.
- `tg_engine_ask` cannot be used for decision-critical deterministic intent selection.
- Routing metadata returned by a paid call is **UNVERIFIED**; the MCP returns only parsed JSON bodies and discards response headers.

This requires operator confirmation or one authorized paid contract test before implementation.

## 7. x402/payment model

**OFFICIAL:** Paid calls first receive HTTP 402. The current MCP uses `@x402/fetch`, `@x402/evm`, and a viem signer; it automatically parses the challenge, signs an exact-scheme EVM authorization (documented as EIP-3009), and retries. Standard x402 v2 uses a base64 `PAYMENT-REQUIRED` response header and `PAYMENT-SIGNATURE` retry header; older Telegraph README prose also mentions `PAYMENT`, so use the official SDK rather than hardcoding header names. Telegraph documentation says settlement is via a PayAI facilitator.

Required configuration: `TELEGRAPH_NODE_URL`, `TELEGRAPH_ENGINE_URL`, `TELEGRAPH_DAEMON_URL`, and at least one of `TELEGRAPH_EVM_PRIVATE_KEY` or `TELEGRAPH_SOLANA_PRIVATE_KEY`; optional `EVM_NETWORK`, `SVM_NETWORK`, and `REFRESH_INTERVAL_MS`.

**OFFICIAL:** Use a burner wallet with only needed funds; the key remains inside the local/server MCP process. **INFERRED:** A server-side burner is appropriate for Nexora, with per-decision spend caps and no client exposure.

**UNVERIFIED:** The live challenge's network/token/facilitator fields and settlement receipt were not inspected because no paid request was made. Contemporary official hackathon messaging says Base Sepolia USDC, while MCP defaults are wildcard CAIP-2 networks; confirm from the live 402 before funding. Actual cost cannot reliably be captured from the current MCP result alone because headers are discarded. Capture the challenge amount and payment/settlement response headers in a server-side wrapper or obtain Engine cost/receipt fields if a paid test proves they exist.

## 8. Error and timeout semantics

**OFFICIAL source:** Dispatcher and Engine calls have a 30,000 ms `AbortController` timeout; daemon reads have 15,000 ms. Non-2xx is surfaced as an error with status/body; invalid JSON fails parsing. MCP tool errors set `isError: true`. Routing errors and payment errors receive friendlier text, but there is no automatic low-risk fallback.

**UNVERIFIED:** Network retries beyond the x402 challenge retry, miner-specific timeout bodies, rate limits, idempotency, and whether payment can settle before a miner times out. Treat timeout, malformed JSON, schema mismatch, and partial evidence as distinct REVIEW/BLOCK inputs—not low risk.

## 9. Parallel-call feasibility

**INFERRED:** Independent dispatcher/Engine calls use ordinary fetch and have no shared serialization in inspected client code, so 2–3 calls can be issued concurrently. Wall-clock latency should approach the slowest call (bounded near 30 seconds client-side), rather than their sum.

Each successful paid call has an independent x402 payment. A parallel workflow therefore needs an aggregate budget, concurrency limit (start at 3), independent abort controllers, `Promise.allSettled`-style collection, and per-channel replay status. Do not fail-fast and discard completed evidence. Protocol/server concurrency limits, rate limits, nonce contention, and simultaneous EIP-3009 behavior remain **UNVERIFIED** and require a later funded smoke test.

## 10. Recommended 2–3 intent MVP combination

Use **URL_SCAN + ONCHAIN_TX_LOOKUP + FACT_CHECK**.

- ONCHAIN_TX_LOOKUP supplies deterministic settlement facts.
- URL_SCAN supplies bounded infrastructure/domain risk.
- FACT_CHECK supplies explicit disagreement, source diversity, coverage, abstention, and provenance.

FRAUD_DETECTION is useful but too heterogeneous as a primary MVP channel until a narrower contract/profile is chosen. NEWS_SEARCH is best treated as evidence retrieval feeding a fact-check claim, not as an independent safety verdict.

## 11. Recommended single Nexora workflow

**Supplier payment authorization:** proposed action includes supplier identity, invoice/payment URL, destination wallet, chain, and—when verifying prior settlement—a transaction hash. In parallel, request URL risk, exact on-chain transaction evidence, and a tightly phrased factual supplier/incident claim. Normalize only declared fields; preserve raw response plus schema/registry snapshots. A deterministic local policy produces ALLOW/REVIEW/BLOCK. Missing URL, missing transaction hash, abstention, conflict, timeout, invalid schema, and out-of-coverage remain explicit—not silently converted to safety.

If pre-payment authorization has no transaction hash yet, ONCHAIN_TX_LOOKUP cannot validate the proposed transfer. The workflow should either verify a supplier-provided historical transaction or move that channel to post-payment confirmation. This is a material product constraint.

## 12. Risks/blockers

1. Proven Engine interface lacks the documented deterministic intent-routing contract.
2. Paid response envelope, routing metadata, settlement receipt, and actual miner schema conformance are unverified.
3. Registry `active` is not live endpoint health.
4. Intent semantics are heterogeneous, especially FRAUD_DETECTION.
5. Current official surfaces use plain HTTP IP endpoints; server-side transport/security expectations need confirmation.
6. The registry is mutable and must be treated as time-versioned external input.
7. Pre-payment ONCHAIN_TX_LOOKUP needs an existing transaction hash; it cannot predict a not-yet-created payment.

## 13. Architecture implications

Keep four layers separate: discovery snapshot; bounded concurrent Telegraph calls and x402 accounting; strict per-miner schema normalization; deterministic decision policy. Store requested intent, registry record/hash, selected miner ID, endpoint/method, timestamps, response or typed failure, payment amount/receipt when available, normalized facts, conflicts/missing evidence, thresholds, and final reason. Never let an LLM-generated narrative directly decide ALLOW.

Do not hardcode a favored miner. Until deterministic intent-routing is confirmed, select from the current compatible pool by an explicit neutral rule (for example Telegraph rank plus contract-compatibility filtering), record the rule, and preserve Telegraph's ranking metadata.

## 14. Files changed

- Created `docs/telegraph-runtime-audit.md` only.

No application code, dependencies, configuration, or Sigvora files were created or modified.

## 15. Commands/tests performed

- Enumerated workspace files and Git status with `rg --files` and `git status --short`.
- Inspected relevant environment-variable names without printing values.
- Queried the free live integrations registry and parsed candidate counts, metadata, methods, schemas, prices, request/scoring fields, and timestamps.
- Probed documented/likely free health and listing paths; recorded 200/404 results.
- Inspected official MCP README, architecture, environment example, Engine tool source, dispatcher client source, x402 source, explorer, developer console, and hackathon rules.
- Made zero inference calls, zero payment attempts, and zero direct miner calls.

## 16. Recommendation

**MODIFY, then GO.** The core Nexora concept remains viable and the proposed evidence-before-policy separation is well matched to Telegraph. Modify the initial plan to use URL_SCAN + FACT_CHECK plus conditional ONCHAIN_TX_LOOKUP, and do not depend on `tg_engine_ask`. Before building, obtain one of:

1. official confirmation and contract for explicit intent-level probabilistic routing, or
2. approval for a minimal funded smoke test that captures the live 402 challenge, route/result envelope, headers, actual cost, and one schema-valid response per chosen intent.

If Track 3 judging requires probabilistic Telegraph routing rather than merely real Telegraph miners, this confirmation is a hard gate.

---

# PHASE 2 — ROUTING AND CONTRACT AUDIT

Phase 2 timestamp: 2026-09-02 (Africa/Lagos). This section preserves Phase 1 above and supersedes only conclusions explicitly revised below. Full per-miner tables are in [telegraph-contract-compatibility-matrix.md](./telegraph-contract-compatibility-matrix.md).

Evidence labels in this section are deliberately explicit:

- **VERIFIED FROM LIVE REGISTRY** — observed from the free runtime catalog during Phase 2.
- **VERIFIED FROM OFFICIAL DOCUMENTATION/SOURCE** — established by Telegraph's official API specification, repositories, or hackathon documentation.
- **INFERRED** — an architecture conclusion based on verified evidence.
- **UNVERIFIED** — requires a paid call, missing implementation source, or operator confirmation.

## P2.1 Registry re-check and candidate counts

**VERIFIED FROM LIVE REGISTRY:** A fresh `GET http://13.237.89.59:7044/miner-dispatcher/integrations` returned 129 registrations. Counts and activation states were unchanged from Phase 1:

| Intent | Phase 1 | Phase 2 total | Active | Inactive | Change |
|---|---:|---:|---:|---:|---:|
| FRAUD_DETECTION | 15 | 15 | 15 | 0 | 0 |
| URL_SCAN | 10 | 10 | 10 | 0 | 0 |
| ONCHAIN_TX_LOOKUP | 12 | 12 | 12 | 0 | 0 |
| NEWS_SEARCH | 5 | 5 | 5 | 0 | 0 |
| FACT_CHECK | 4 | 4 | 4 | 0 | 0 |

All candidate registrations exposed `activation_status: active`. This remains registry state, not a direct endpoint-health check.

**Material identity discrepancy:** The Phase 2 brief calls Sigvora “Miner #315”; the live registry currently identifies `slug: sigvora`, `name: Sigvora Fraud Intelligence` as ID **251**, active, FRAUD_DETECTION, price 10,000, rank 8, score 0. **VERIFIED FROM LIVE REGISTRY.** No assumption is made that 251 and 315 are interchangeable; resolve this with Telegraph/operator records before referring to its ID in product documentation.

## P2.2 Exact routing conclusion

**NO VERIFIED EXPLICIT INTENT-ROUTING CONTRACT FOUND.**

**VERIFIED FROM OFFICIAL DOCUMENTATION/SOURCE:** The current OpenAPI—described by its repository as the HTTP/WS source of truth—defines:

- `POST /v1/ask`: required `query: string`, optional free-form `context`; no caller-supplied `intent` field.
- `POST /v1/ask/{subnet_id}`: required `method`, `endpoint`, and `payload`; caller selects the miner.
- `GET /v1/intents`, `GET /v1/intents/{id}`, and `GET /v1/intents/{id}/miners`: discovery only, not inference routing.
- WebSocket `ask`: natural-language query; `ask_direct`: explicit subnet ID. No explicit-intent inference action is declared.

The OpenAPI states that `/v1/ask` “classifies the natural-language query via the LLM router, picks the top-2 ranked miners for the detected intent, tries the primary then the fallback miner.” This resolves the earlier A/B ambiguity: it is **A**—LLM intent classification followed by ranked compatible-miner selection—not an LLM directly choosing an arbitrary specific miner. It then makes a deterministic-looking primary/fallback choice from the top two; any tie-breaking details are **UNVERIFIED**.

The successful `AskResponse` can contain `miner_used`, `miner_name`, `endpoint`, free-form `result`, `cost_usd`, `duration_ms`, `timestamp`, optional routing `reasoning`, and detected `intent`. Direct-call responses can contain `miner_id`, `miner_name`, result, cost, duration, and timestamp. Actual live conformance is **UNVERIFIED** because no paid call was made.

## P2.3 Operational meaning of probabilistic routing

**VERIFIED FROM OFFICIAL DOCUMENTATION/SOURCE:** Protocol documentation says miners are selected based on leaderboard score; higher-scoring miners receive a proportionally larger traffic share. New miners in a seven-day grace period collectively receive 5% of routed requests. Spot-check degradation greater than 20% can revoke a miner from routing and redistribute its share. Scores are produced by per-intent canonical WASM evaluation and validator consensus.

**VERIFIED FROM OFFICIAL DOCUMENTATION/SOURCE:** The current `/v1/ask` API contract instead describes top-two ranking plus primary/fallback, not probability sampling. No inspected source specifies the random-number source, exact score-to-probability formula, zero-score treatment, grace-period implementation, or where a probabilistic draw occurs for public HTTP calls.

**INFERRED:** “Probabilistic routing” is a documented protocol/economic target, while the presently exposed Engine contract demonstrably provides LLM classification and rank-ordered top-two failover. It must not be claimed that current public `/v1/ask` performs weighted random selection without implementation evidence or a routed-response study.

Where verified, ranking/scoring/reputation affect eligibility and order/traffic share. The exact influence of randomness in the current live Engine remains **UNVERIFIED**.

## P2.4 Routing options and architecture decision

| Option | Legitimacy / Telegraph-native | Determinism | Neutrality / ranking | Replay quality | Track 3 assessment |
|---|---|---|---|---|---|
| A. Explicit intent → Telegraph routing | Described conceptually but no inference contract found | would be high | would be ideal | would be ideal | **UNAVAILABLE/UNVERIFIED** |
| B. Registry filter → neutral app selection → direct Telegraph call | Uses live Telegraph discovery, scores, dispatcher/Engine, and x402 | high | clean if rule is ownership-blind; can use rank | excellent | **RECOMMENDED** |
| C. `tg_engine_ask` | fully native and paid | intent classification is LLM-dependent | Engine chooses top-two by rank | good metadata, weaker reproducibility | unsuitable for decision-critical core; useful exploratory fallback |
| D. Intent discovery endpoints + inference | discovery is verified | n/a | returns compatible miners | good discovery record | not a routing mechanism by itself |

**Chosen strategy — Option B:** At decision start, snapshot the registry; filter by exact intent, `active`, schema presence, required contract family, acceptable price, and current scoring metadata; order by Telegraph-provided rank (lower is better), then stable miner ID as tie-break; call the first eligible miner through Telegraph's paid direct route. If that call fails, record the failure and only try the next eligible miner if the decision's explicit retry/budget policy permits it. Never alter filtering, ordering, or thresholds based on ownership.

**INFERRED:** This is reproducible, explainable, provider-neutral, and uses Telegraph ranking without inventing an unverified probability formula. Its limitation is concentration on the highest ranked contract-compatible miner rather than proportional traffic sharing. Revisit this choice if Telegraph publishes a callable explicit-intent router or exact weighting algorithm.

Do not implement “score-weighted random” from the current floating scores: the exact transform, grace share, revocations, and zero-score behavior are not specified. Doing so would imitate rather than preserve Telegraph routing semantics.

## P2.5 Provider-neutrality conclusion

1. Can Nexora request FRAUD_DETECTION without naming Sigvora? **Yes, at the application layer:** discover all FRAUD_DETECTION miners and apply the ownership-blind Option B rule. **No verified Telegraph-native exact-intent inference request exists.**
2. Can Telegraph itself choose among fraud miners? `/v1/ask` can after LLM intent detection and selects the top-two ranked compatible miners. The caller cannot lock the detected intent through the verified request schema.
3. Can application selection be neutral? **Yes (INFERRED)** if eligibility and ordering are predeclared, derived only from registry contract compatibility/rank/price/active status, and recorded in Decision Replay.
4. Best current neutral strategy: highest Telegraph-ranked eligible miner with stable ID tie-break and bounded explicit fallback. This respects published rank more faithfully than uniform random selection and avoids inventing score probabilities.

Sigvora receives no special treatment. Its live registry entry has a missing input/output schema, so it is excluded from any schema-required fraud pool for the same reason any other schema-less miner is excluded. If its registry contract later becomes compatible and normal neutral ordering selects it, that incidental result is acceptable.

## P2.6 FRAUD_DETECTION compatibility

**Classification: HETEROGENEOUS; supplier-context support: PARTIALLY.**

**VERIFIED FROM LIVE REGISTRY:** The 15 miners span at least these families: free-text fraud/scam research, wallet/on-chain anomaly, IP reputation, email reputation, structured action/evidence gating, counterparty/deal verification, contract capability risk, crypto-market risk, and undeclared schemas. Inputs and outputs are materially different.

The largest plausible supplier-context request family is `query: string`, declared by six miners: DegenLens, ChainSight, SarzOps, TxLens, Anchor, and Sentinel. Only two declare `query` required; runtime sufficiency for the other four is **UNVERIFIED**. No top-level output field is common to all six. Their declared `signal_mapping` fields allow miner-specific extraction, but labels and reasons have different semantics.

Therefore Nexora cannot submit supplier communication/payment context to the full neutral fraud pool without miner-specific payload logic. It can legitimately support a neutral schema-qualified six-miner family with a common `{query}` request concept, per-miner output adapters, and strict semantic preservation. Before calling this a production-compatible family, one neutral paid conformance test is required.

The normalizer must preserve whether the result is a narrative fraud finding, wallet risk, reputation observation, or action-evidence gate. It must not coerce all results to one generic score.

## P2.7 URL_SCAN compatibility

**Classification: CORE, with a schema-qualified subset.**

**VERIFIED FROM LIVE REGISTRY:** Seven of ten active miners declare a `url` property. URL Sentinel and ProofGate require it; Preflight, NetWire, URLScan.io, VirusTotal, and PhishTank declare it optional. The remaining three use `query` or have missing schemas. Outputs vary among bounded threat verdicts, TLS/reachability facts, provider-native findings, phishing-database membership, and asynchronous scan identifiers/results.

Only four of the seven expose top-level confidence and three expose top-level verdict. No response field is universal. Despite heterogeneity, the input concept is natural and interoperability is sufficient for a core domain if routing is restricted to the declared-`url` family and responses are normalized into typed threat, reachability/TLS, phishing, and provider-native evidence.

## P2.8 FACT_CHECK compatibility and legitimate role

**Classification: CONDITIONAL.**

**VERIFIED FROM LIVE REGISTRY:** Three of four miners declare `query`: LiveCert, Tavily, and Qarinah; Tavily and Qarinah require it. Assay has no schemas. LiveCert and Qarinah expose claim/verdict/confidence/evidence concepts; Tavily exposes search answer/results rather than a bounded fact-check verdict. Qarinah additionally declares conflict, coverage, abstention, provenance, and verification hashes.

FACT_CHECK naturally checks textual claims or questions, not whether a payment itself is valid. A legitimate role is verifying a concrete externally checkable supplier claim—for example, a claimed license, public certification, announced acquisition, or disclosed incident—when that claim materially affects authorization. Using it as a generic “is this supplier safe?” signal would stretch the intent and invite narrative ambiguity.

## P2.9 ONCHAIN_TX_LOOKUP compatibility and role

**Classification: CONDITIONAL.**

**VERIFIED FROM LIVE REGISTRY:** Transaction miners use incompatible identifiers: `hash`, `tx_hash`, or `txHash`, and chain fields `chain` or `chainId`. Some schemas do not mark identifiers required; others strictly do. One advertised miner (VulnFeed) analyzes a contract address rather than a transaction and must be excluded from a transaction lookup pool.

Useful factual outputs include existence/status, pending/confirmed/reverted/not-found lifecycle, block and confirmations, sender/recipient, native value, gas/fee, method/effects, logs/transfers, finality, timestamp, and source/summary. Fraud/risk semantics are generally absent; ONCHAIN_TX_LOOKUP should remain factual.

It can legitimately verify a referenced transaction, prior supplier payment, historical settlement, or a post-payment result. It cannot produce evidence for a transaction that does not yet exist. Wallet-only investigation belongs to other endpoints/intents and is not a common ONCHAIN_TX_LOOKUP guarantee.

## P2.10 NEWS_SEARCH fallback assessment

**Classification: FALLBACK.**

**VERIFIED FROM LIVE REGISTRY:** Five active miners offer query-based news/search contracts with varying article normalization. It can support scenario-specific adverse-news, public security-incident, fraud-allegation, or regulatory-event research. Results are allegations/public reporting rather than verified fraud findings and must retain source, time, and uncertainty. Use only when a policy explicitly asks a factual public-context question; do not make generic news search mandatory for every payment.

## P2.11 Minimal common contracts

These are registry-derived contract families, not universal intent standards:

| Intent | Largest useful request concept | Coverage | Smallest response concepts that are genuinely common |
|---|---|---:|---|
| FRAUD_DETECTION | `{query: string}` declared | 6/15 | none universal across six; use each miner's signal mapping and preserve native semantics |
| URL_SCAN | `{url: string}` declared | 7/10 | URL target concept only; confidence 4/7, verdict 3/7; typed adapters required |
| FACT_CHECK | `{query: string}` declared | 3/4 | no universal result field; LiveCert/Qarinah share verdict/confidence/evidence, Tavily does not |
| ONCHAIN_TX_LOOKUP | `{chain, hash}` declared | 6/12 | factual transaction concepts recur, but no uniform names/required set |
| ONCHAIN_TX_LOOKUP | `{chain, tx_hash}` declared | 5/12 | same limitation; DegenLens also requires query |

**VERIFIED FROM LIVE REGISTRY:** No candidate intent implies a universal wire schema. `supported_intents` is compatibility/routing/scoring metadata, not an input/output standard.

## P2.12 Cross-intent independence

**INFERRED from verified contracts:**

- FRAUD_DETECTION + URL_SCAN are meaningfully independent only when fraud assesses supplier communication/counterparty/payment context and URL_SCAN assesses the actual invoice/domain infrastructure. Fraud miners that merely rescan a URL would duplicate URL_SCAN and should be excluded from that decision profile.
- ONCHAIN_TX_LOOKUP adds the strongest independent domain: direct blockchain facts, conditional on an existing hash.
- FACT_CHECK overlaps with narrative fraud research/news retrieval and is best scenario-specific.
- NEWS_SEARCH can feed public context but is not independent verification merely because it comes through a different intent; sources may overlap with fraud/fact-check providers.

The preferred Fraud + URL + conditional on-chain combination is objectively sound if the fraud pool is restricted to non-URL supplier/context analysis and native evidence semantics are preserved.

## P2.13 Supplier/payment workflow suitability and provisional policy

The contracts support an evidence-first policy shape **INFERRED**, with limitations:

- Core: supplier/payment-context FRAUD_DETECTION from the schema-qualified neutral pool.
- Core when a URL is present: URL_SCAN.
- Conditional when a real transaction hash exists: ONCHAIN_TX_LOOKUP.
- Conditional/fallback: concrete-claim FACT_CHECK or adverse-context NEWS_SEARCH.

ALLOW can require all contextually required channels to return schema-valid, non-adverse, sufficiently complete evidence. REVIEW covers missing inputs/evidence, abstention, timeout, invalid schema, ambiguous narrative, insufficient confidence, or cross-domain conflict. BLOCK requires a domain-specific critical fact satisfying an explicit rule (for example, a malicious URL verdict from an accepted contract); a successful historical transaction is not semantically interchangeable with a safe fraud result.

## P2.14 Parallel-call recommendation

**Recommendation: HYBRID.**

Run FRAUD_DETECTION and URL_SCAN concurrently when both inputs exist. Run ONCHAIN_TX_LOOKUP concurrently as well if a real referenced/historical hash is already part of the proposal; otherwise omit it or perform post-settlement verification later. Trigger FACT_CHECK/NEWS_SEARCH only when a concrete scenario rule requires it.

**VERIFIED FROM OFFICIAL SOURCE:** MCP dispatcher and Engine clients independently create 30-second abort timers; daemon calls use 15 seconds. There is no client-side serialization in the inspected code. Each paid call independently crosses x402. Non-2xx and invalid JSON become errors.

**INFERRED:** Use bounded concurrency (maximum three), per-call abort state, aggregate budget, and all-settled collection. Partial success must be preserved. Do not fail-fast or treat timeout as safety. Server rate limits, concurrent payment behavior, and whether funds can settle before downstream failure remain **UNVERIFIED**.

## P2.15 x402/payment findings

**VERIFIED FROM OFFICIAL DOCUMENTATION/SOURCE:** Initial paid request omits `PAYMENT-SIGNATURE` and receives HTTP 402. The documented example body contains `error` and `accepts[]` entries with `scheme`, `price` in micro-USDC, `network`, and `payTo`. The client pays/signs and retries with `PAYMENT-SIGNATURE`; legacy `X-Payment` is retired. Typical price is 10,000 micro-USDC ($0.01), dynamically based on the miner's on-chain minimum. Networks documented are Base Sepolia (default testnet), Base, Polygon, and Solana Devnet. Telegraph MCP uses `@x402/fetch`, EVM exact scheme/EIP-3009 signing, or optional SVM modules.

Configuration: `TELEGRAPH_NODE_URL`, `TELEGRAPH_ENGINE_URL`, `TELEGRAPH_DAEMON_URL`, one server-side private key (`TELEGRAPH_EVM_PRIVATE_KEY` or optional Solana key), optional CAIP-2 network selectors, and refresh interval. Official guidance recommends a minimally funded burner wallet and keeps keys inside the MCP process.

The OpenAPI declares `cost_usd` in Engine responses, making it a candidate Decision Replay field. Capture challenge price/network/payTo, chosen miner and endpoint, Engine `cost_usd`, payment/settlement headers if exposed, and transaction/receipt identifier if available. Exact live header/body versions, facilitator receipt, settlement timing, and actual metadata remain **UNVERIFIED** until the paid smoke test.

## P2.16 Proposed first paid smoke-test plan — DO NOT EXECUTE YET

Use exactly three legitimate calls, once each. At test time take one registry snapshot and apply the Option B eligibility/rank rule; never name or target Sigvora.

### Call 1 — FRAUD_DETECTION

1. Intent: FRAUD_DETECTION.
2. Necessity: prove that the six-miner query family accepts real supplier/payment context and returns a schema-valid, semantically usable result.
3. Selection: highest current Telegraph rank among active, price-accepted miners declaring `query: string`, with stable ID tie-break; ownership is not an input.
4. Payload shape: `{ "query": "Assess the fraud indicators in this supplier payment request: an existing supplier asks by email to change the beneficiary wallet immediately, provides no signed change notice, and pressures payment before normal verification. State missing evidence explicitly." }` (adapt only if the selected registry schema declares an additional required field; if so, either satisfy it neutrally or exclude that miner by the predeclared family rule).
5. Input: harmless synthetic scenario, no person, wallet, secret, or accusation.
6. Expected challenge: HTTP 402 with x402 acceptance requirements; retry by official client with `PAYMENT-SIGNATURE`.
7. Expected advertised cost: selected miner's snapshot price, currently typically 10,000 micro-USDC/$0.01.
8. Prerequisites: server-side minimally funded burner, live challenge-supported network/token (expected Base Sepolia USDC, verify rather than assume), official x402 client.
9. Capture: registry/schema hash, selection candidates/order, miner ID/name, endpoint, challenge fields, payment metadata, raw JSON, validation result, signal mapping, cost, duration, timestamp, error state.
10. PASS: exactly one neutral selection, one settlement, JSON conforms to declared schema/mapping, and result clearly preserves adverse/uncertain/missing-evidence semantics.
11. FAIL: intent/payload rejection, schema mismatch, untraceable route/cost, silent low-risk default, or second call made merely to obtain a preferred answer.

### Call 2 — URL_SCAN

1. Intent: URL_SCAN.
2. Necessity: verify `{url}` interoperability and typed URL evidence.
3. Selection: highest current rank among active miners declaring `url`, accepted price, and a synchronous endpoint; stable ID tie-break.
4. Payload: `{ "url": "https://example.com" }` plus no undeclared fields.
5. Input: IANA-reserved public example domain.
6–8. Payment/prerequisites: same one-challenge/one-retry flow; expected current price 10,000 micro-USDC; verify live network/token.
9. Capture: selected contract, verdict/finding/reachability fields, confidence if declared, evidence/reason, raw response, cost/receipt/timing.
10. PASS: schema-valid response whose exact URL-security semantics can be classified without inventing a generic risk score.
11. FAIL: asynchronous workflow cannot complete within one paid call, schema mismatch, ambiguous target, or missing route/payment accounting.

### Call 3 — ONCHAIN_TX_LOOKUP

1. Intent: ONCHAIN_TX_LOOKUP.
2. Necessity: verify alias/chain handling and factual transaction evidence.
3. Selection: highest current rank among active true transaction miners compatible with one predeclared identifier family; exclude contract-only analyzers by semantics, not identity.
4. Payload: the selected miner's exact declared `{chain, hash}` or `{chain, tx_hash}` shape.
5. Input: one already-confirmed public Base Sepolia transaction chosen from an official explorer immediately before the test; record its public hash and expected chain only.
6–8. Payment/prerequisites: same; expected typical 10,000 micro-USDC, verify snapshot/challenge.
9. Capture: existence/status/finality, block/confirmations, parties/value/fee as declared, raw JSON, cost/receipt/timing, and schema result.
10. PASS: returned identifiers match the public input and factual fields are schema-valid, with not-found/pending distinctions preserved by the contract.
11. FAIL: fabricated facts, hash mismatch, contract-risk response instead of transaction facts, schema/payment opacity, or inability to distinguish failure from not-found.

A fourth FACT_CHECK call is not initially justified. Add it only if the MVP adopts a concrete supplier-claim scenario after the three core/conditional contracts pass.

## P2.17 Remaining blockers

1. No verified explicit-intent inference endpoint; application-side selection is currently necessary for deterministic intent choice.
2. Exact probabilistic routing implementation/formula is absent from the inspected public contract/source.
3. Live paid response, x402 challenge/receipt, and schema conformance remain untested by instruction.
4. Same-intent wire contracts are heterogeneous; adapters and eligibility profiles are mandatory.
5. Registry identity mismatch for Sigvora (brief says 315; live registry says 251).
6. Several registered miners lack schemas or advertise semantically mismatched endpoints.
7. `active` does not prove endpoint health; retry/payment-after-failure behavior is unverified.

## P2.18 Final intelligence-domain and architecture decision

Final MVP domains:

1. **FRAUD_DETECTION — CORE, schema-qualified query family only.**
2. **URL_SCAN — CORE when a URL exists, declared-url family only.**
3. **ONCHAIN_TX_LOOKUP — CONDITIONAL on a real existing/reference transaction hash.**

FACT_CHECK is conditional for concrete public claims; NEWS_SEARCH is fallback context. This revises Phase 1's earlier recommendation after full live-contract inspection.

Architecture remains four distinct layers: immutable discovery/selection snapshot; bounded Telegraph/x402 execution; per-contract validation and domain-preserving normalization; deterministic policy. Replay must explain why a miner was eligible, its rank at selection, tie-break/fallback behavior, raw/native findings, missing evidence, payment/cost, and final domain-specific policy interpretation.

## P2.19 Phase 2 recommendation

**MODIFY, then GO TO THE THREE-CALL SMOKE-TEST GATE—do not implement the application yet.**

The concept is viable, and the preferred Fraud + URL + conditional on-chain evidence set is defensible. Modify the architecture to use neutral registry-qualified direct routing and miner-specific adapters. Run the proposed paid smoke tests only after explicit authorization, wallet/network confirmation, and spend cap. Application scaffolding remains blocked until those tests validate payment envelopes and real schema conformance.

---

# PHASE 3 — CONTROLLED X402 SMOKE TEST

Phase 3 preflight timestamp: 2026-09-02T15:19:00.5786899Z. Outcome: **STOPPED BEFORE PAID EXECUTION — PAYMENT PREREQUISITES UNAVAILABLE.** No inference endpoint, payment challenge, signed retry, or miner endpoint was called.

## P3.1 Preflight result

**VERIFIED FROM LIVE EXECUTION (local preflight):** The following environment variables were absent: `TELEGRAPH_NODE_URL`, `TELEGRAPH_ENGINE_URL`, `TELEGRAPH_DAEMON_URL`, `TELEGRAPH_EVM_PRIVATE_KEY`, `TELEGRAPH_SOLANA_PRIVATE_KEY`, `EVM_NETWORK`, and `SVM_NETWORK`. No `.env` or `.env.*` file exists in the Nexora workspace.

Because no payment key is configured, no wallet address could be derived without inventing credentials, and no USDC balance could be checked. Required network/token and sufficient balance therefore could not be established from live wallet state. The Phase 3 safety boundary required stopping before any paid request.

## P3.2 Wallet, network, token, and spend readiness

**VERIFIED FROM OFFICIAL SOURCE:** Telegraph MCP requires its service URLs and at least one payment key. For the intended EVM path, configure these in the server process—not client-visible code:

- `TELEGRAPH_NODE_URL=http://13.237.89.59:7044`
- `TELEGRAPH_ENGINE_URL=http://13.237.89.59:8080` (or the current official Engine base URL if changed)
- `TELEGRAPH_DAEMON_URL=http://13.237.89.59:8081`
- `TELEGRAPH_EVM_PRIVATE_KEY=<dedicated burner key>`
- `EVM_NETWORK=<network accepted by the live 402 challenge>`

Official API documentation identifies Base Sepolia as the default test network, USDC as the payment token, and 10,000 micro-USDC as the typical $0.01 call price. The live challenge remains the authority for `network`, amount, asset/token contract, scheme/version, facilitator, and `payTo`; these are **UNVERIFIED** until a first unsigned request is permitted with a configured wallet.

For three calls currently advertised at 10,000 micro-USDC each, the expected maximum inference spend is **30,000 micro-USDC ($0.03)**. **INFERRED:** fund the dedicated burner with at least $0.05 Base Sepolia USDC to cover the three calls and small price drift, or $0.10 if faucet denomination makes that simpler; enforce a $0.03 test budget unless a fresh registry/challenge price requires explicit re-approval. Do not use a main wallet. Depending on facilitator semantics, native Base Sepolia ETH may not be needed for the EIP-3009 authorization, but that remains **UNVERIFIED** and should be confirmed from the official x402 client/challenge before testing.

Configure secrets through the local task/process secret facility or an ignored file outside version control. Never put the key, seed phrase, full payment signature, or funded wallet details in this repository or browser-delivered code.

## P3.3 Fresh registry snapshot

**VERIFIED FROM LIVE REGISTRY:** The free registry returned 129 registrations at the timestamp above:

| Intent | Total | Active |
|---|---:|---:|
| FRAUD_DETECTION | 15 | 15 |
| URL_SCAN | 10 | 10 |
| ONCHAIN_TX_LOOKUP | 12 | 12 |
| NEWS_SEARCH | 5 | 5 |
| FACT_CHECK | 4 | 4 |

These counts are unchanged from Phases 1 and 2. No inactive candidate was observed.

## P3.4 Neutral selection results (planned, not called)

The Phase 2 rule was applied without owner/project identity and without changing criteria after results were visible.

### FRAUD_DETECTION query-only family

Eligibility required exact intent, active status, usable price, non-null input/output schemas, a declared `query: string`, and no required payload fields other than `query`. **VERIFIED FROM LIVE REGISTRY:**

| Rank | Score | Miner | Price (micro-USDC) |
|---:|---:|---|---:|
| 1 | 1 | 49 Anchor | 10,000 |
| 2 | 1.1243167e-13 | 91001 SarzOps | 10,000 |
| 3 | 4.976477e-14 | 302 ChainSight | 10,000 |
| 4 | 3.8063296e-14 | 10002 DegenLens | 10,000 |
| 5 | 8.140558e-15 | 9002 TxLens | 10,000 |
| 6 | 7.252309e-15 | 94217603 Sentinel | 10,000 |

Planned winner: **Miner 49, Anchor**, because it has the best Telegraph-provided rank among eligible miners. Its relevant endpoint is `GET /risk-check`, with `query` and `wallet` declared optional; its output requires `verdict`, `reasoning`, `confidence`, and `meta`. Payload validity is supported by the registry schema; whether query-only supplier context is semantically sufficient is **UNVERIFIED** until execution.

EviPlan and Tele declare `query` but require additional fields, so they do not belong to the query-only payload family. Schema-less miners, including Sigvora, are excluded under the same rule.

### URL_SCAN declared-url synchronous family

**VERIFIED FROM LIVE REGISTRY:** Eligible order was NetWire (rank 1), Preflight (2), ProofGate (3), URL Sentinel (5), VirusTotal (6), PhishTank (7), and URLScan.io (8), all priced at 10,000 micro-USDC. Planned winner: **Miner 7334, NetWire URL Scan**, `GET /url-scan`, because it has the best rank. It declares `url`/`question` and returns URL/reachability/TLS/status/summary/confidence fields. Planned payload: `{ "url": "https://example.com" }`.

### ONCHAIN_TX_LOOKUP true-transaction family

Eligibility required a real transaction identifier field and excluded the semantically mismatched contract analyzer. **VERIFIED FROM LIVE REGISTRY:** Eligible order was Veyctum (rank 1), ChainSight (2), Interlock (3), TxLens (4), DegenLens (5), ChainWire (6), OnChain Intel (7), Preflight (8), Truvian (9), Verity (11), and Sigil (12), all priced at 10,000 micro-USDC. Planned winner: **Miner 9005, Veyctum**, `GET /lookup`, because it has the best rank. Its required input is `tx_hash`, with optional `chain`/`format`; planned payload is `{ "chain": "base-sepolia", "tx_hash": "<confirmed public non-personal transaction selected immediately before execution>" }` after independent explorer confirmation.

## P3.5 Runtime results and contract conformance

FRAUD_DETECTION: **NOT RUN — UNVERIFIED.**

URL_SCAN: **NOT RUN — UNVERIFIED.**

ONCHAIN_TX_LOOKUP: **NOT RUN — UNVERIFIED.**

No advertised-versus-actual conformance classification (`MATCH`, `COMPATIBLE_WITH_ADAPTER`, `MISMATCH`, or `INVALID`) can honestly be assigned without responses. The Phase 2 registry-only conclusions remain unchanged, so the compatibility matrix was not modified.

## P3.6 Actual x402 lifecycle and costs

**VERIFIED FROM LIVE EXECUTION:** No 402 challenge or `PAYMENT-SIGNATURE` exchange occurred. No payment was signed or settled. No response cost, miner identity envelope, duration, timestamp, or settlement receipt was observed.

Logical paid inference calls: **0**. Total spend: **$0.00**.

The expected lifecycle remains **VERIFIED FROM OFFICIAL SOURCE**, not live execution: unsigned paid request → 402 challenge → exact-scheme authorization/signing → retry with `PAYMENT-SIGNATURE` → final inference response. The current Engine schema can return miner identity, `cost_usd`, duration, and timestamp, but live conformance remains **UNVERIFIED**.

## P3.7 Normalization implications

No new response evidence exists. Phase 2's proposed model remains **INFERRED/UNVERIFIED**:

- Common core: requested intent, registry snapshot/schema hash, selected miner, endpoint, execution status, timestamps/latency, payment/cost metadata, raw response reference, and validation status.
- Domain-specific: fraud verdict/reasoning/context coverage; URL threat/reachability/TLS findings; on-chain existence/status/finality/parties/value/fee.
- Miner-specific: native labels, evidence structures, nested metadata, and signal-mapping paths.

Do not implement this model until live responses establish which fields are actually returned.

## P3.8 Failure semantics

The future internal execution states remain:

| Runtime outcome | Internal state | Policy implication |
|---|---|---|
| successful, schema-valid response | `AVAILABLE` | evaluate native evidence; never assume low risk merely from success |
| timeout/abort | `TIMED_OUT` | required evidence missing → REVIEW or stricter policy |
| HTTP 4xx other than normal first 402 | `INVALID_REQUEST` or `UPSTREAM_REJECTED` | do not retry blindly; REVIEW |
| HTTP 5xx / miner unavailable | `UNAVAILABLE` | preserve outage; REVIEW or stricter policy |
| payment challenge cannot be satisfied/verified | `PAYMENT_FAILED` | no intelligence exists; REVIEW, operator action |
| malformed JSON | `INVALID` | reject response; REVIEW |
| schema mismatch | `INVALID` | preserve raw evidence privately; do not interpret |
| valid response without confidence | `AVAILABLE_WITHOUT_CONFIDENCE` | use only if domain policy permits non-confidence facts; otherwise REVIEW |
| valid response without evidence/reason | `AVAILABLE_WITHOUT_SUPPORT` | bounded label alone is insufficient for high-impact ALLOW unless policy explicitly permits it |

These are **INFERRED** policy recommendations based on official client behavior and product constraints; live error bodies remain **UNVERIFIED**.

## P3.9 Sigvora neutrality and ID discrepancy

**VERIFIED FROM LIVE REGISTRY:** Sigvora remains ID 251 in this snapshot, active under FRAUD_DETECTION, with null input/output schemas and rank 8. The supplied project note still names ID 315. The discrepancy remains unresolved and was not investigated through miner traffic.

Sigvora was excluded because it failed the same non-null-schema/query-family test applied to every miner. It was not named in a call, manually tested, given a probability adjustment, or used to change selection criteria. Zero inference calls reached Sigvora or any other miner.

## P3.10 MVP domains, blockers, and recommendation

Without live paid results, no Phase 2 domain can be promoted or removed based on runtime evidence:

- FRAUD_DETECTION: **KEEP PROVISIONALLY as CORE; runtime unverified.**
- URL_SCAN: **KEEP PROVISIONALLY as CORE when a URL exists; runtime unverified.**
- ONCHAIN_TX_LOOKUP: **KEEP PROVISIONALLY as CONDITIONAL on a real hash; runtime unverified.**

Remaining blockers are a securely configured dedicated burner, live network/token/challenge confirmation, sufficient test USDC, public Base Sepolia transaction selection, three runtime responses, contract conformance classifications, and cost/settlement metadata capture.

**STOP.** Securely configure and fund the burner, then explicitly resume this Phase 3 test. Do not scaffold or implement Nexora before the three controlled calls either pass or produce a documented architecture change.
