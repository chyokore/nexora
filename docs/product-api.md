# Nexora product API foundation

The Product API exposes the deterministic decision core, free Telegraph discovery, and live reference decision workflow through a lightweight built-in Node.js HTTP service without framework dependencies.

```text
Public Vercel Web App
        ↓
Nexora Product API (Render)
 ├─ GET /health (Service status)
 ├─ GET /v1/discovery (Free Telegraph registry inspection)
 ├─ POST /v1/decisions/evaluate (Deterministic policy evaluation)
 ├─ POST /v1/replays/verify (Decision replay integrity verification)
 └─ POST /v1/agent/run (Live reference agent decision workflow)
        ↓
Decision Core & Payment Guard
 ├─ Evidence Requirement Planner
 ├─ Neutral Miner Discovery
 ├─ Guarded x402 Payment Adapter
 ├─ Evidence Assessment & Action Policy
 └─ Decision Resolution & Replay Proof
```

Start locally from `scripts/telegraph-smoke` with `npm run start:api`. The service uses `PORT` when supplied and otherwise listens on port 3000. It starts without wallet credentials.

## Endpoints

- `GET /health` returns `{"status":"ok","service":"nexora-api","version":"1"}`.
- `GET /v1/discovery` queries the free Telegraph registry node (`TELEGRAPH_NODE_URL`), performs neutral miner selection across core intents (`FRAUD_DETECTION`, `URL_SCAN`, `ONCHAIN_TX_LOOKUP`, `FACT_CHECK`, `NEWS_SEARCH`), and returns candidate counts and winner metadata. Uses a 5-second timeout and returns HTTP 503 if Telegraph discovery is temporarily unreachable (with zero mock substitution). Free read-only discovery; produces zero paid calls or signatures.
- `POST /v1/decisions/evaluate` accepts exactly `{"proposedAction": ProposedAction, "evidenceAssessments": EvidenceAssessment[]}`. It constructs the canonical supplier-payment policy, builds the deterministic DecisionPacket, replays it independently, and returns `{"decisionPacket": ..., "decisionReplay": ...}`.
- `POST /v1/replays/verify` accepts one historical DecisionPacket directly and returns the canonical DecisionReplay. A replay `MISMATCH`, `INVALID_PACKET`, or `UNSUPPORTED_VERSION` remains HTTP 200 because replay validation completed successfully.
- `POST /v1/agent/run` runs the reference agent workflow. It accepts `{"proposedAction": ProposedAction}`, plans required evidence, neutrally selects top miners, executes guarded x402 paid calls on Base Sepolia (`eip155:84532`), assesses evidence, computes the policy decision, and derives plain-language resolution guidance.

Requests must use `application/json` and remain at or below 65,536 bytes. Errors use `{"error":{"code":"...","message":"...","details":[]}}` without stack traces or echoed payloads. Unknown routes return 404, wrong methods 405, malformed JSON 400, unsupported content type 415, and oversized bodies 413.

## Live Decision Safety Architecture & Limits

The `POST /v1/agent/run` endpoint incorporates five defense-in-depth security layers:

1. **Run-Scoped Payment Identities:** Every run gets an immutable server-generated run ID (e.g. `run:7f3a...`). Logical call IDs are derived deterministically as `<runId>:<INTENT>` (e.g. `run:7f3a...:FRAUD_DETECTION`). The public user cannot choose run IDs or logical call IDs. Duplicate authorizations for the same intent within a single run are strictly rejected by `LiveRunLedger`.
2. **Process Budget Guard:** Limits spend within the current server process lifetime (configurable via `LIVE_AGENT_DAILY_BUDGET_MICRO_USDC`, default 1.50 USDC). Process spend stats explicitly declare `scope: "process_scoped"` to avoid false claims of durable accounting without a database.
3. **Burner Wallet Balance Ceiling:** Hard ceiling provided by a dedicated, minimally funded burner wallet on Base Sepolia. The wallet cannot execute calls beyond its on-chain USDC balance regardless of process state.
4. **Per-Decision Cap & Cooldown:** Enforces max 3 paid calls and max 30,000 micro-USDC (0.03 USDC) per run, with a mandatory 60-second per-client cooldown and global concurrency limit of 2.
5. **Emergency Disable Switch:** Setting `ENABLE_LIVE_REFERENCE_AGENT=false` immediately disables the endpoint, returning HTTP 503 `LIVE_AGENT_DISABLED` without modifying wallet credentials.
