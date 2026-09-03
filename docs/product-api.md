# Nexora product API foundation

The Product API exposes the deterministic decision core and free Telegraph discovery through a lightweight built-in Node.js HTTP service without framework dependencies.

```text
Public Vercel Web App
        ↓
Nexora Product API (Render)
 ├─ GET /health (Service status)
 ├─ GET /v1/discovery (Free Telegraph registry inspection)
 ├─ POST /v1/decisions/evaluate (Deterministic policy evaluation)
 └─ POST /v1/replays/verify (Decision replay integrity verification)
        ↓
Decision Core
 ├─ Evidence Assessment
 ├─ Action Policy
 ├─ Decision Packet
 └─ Decision Replay
```

Start locally from `scripts/telegraph-smoke` with `npm run start:api`. The service uses `PORT` when supplied and otherwise listens on port 3000. It starts without wallet credentials.

## Endpoints

- `GET /health` returns `{"status":"ok","service":"nexora-api","version":"1"}`.
- `GET /v1/discovery` queries the free Telegraph registry node (`TELEGRAPH_NODE_URL`), performs neutral miner selection across core intents (`FRAUD_DETECTION`, `URL_SCAN`, `ONCHAIN_TX_LOOKUP`, `FACT_CHECK`, `NEWS_SEARCH`), and returns candidate counts and winner metadata. Uses a 5-second timeout and returns HTTP 503 if Telegraph discovery is temporarily unreachable (with zero mock substitution). Free read-only discovery; produces zero paid calls or signatures.
- `POST /v1/decisions/evaluate` accepts exactly `{"proposedAction": ProposedAction, "evidenceAssessments": EvidenceAssessment[]}`. It constructs the canonical supplier-payment policy, builds the deterministic DecisionPacket, replays it independently, and returns `{"decisionPacket": ..., "decisionReplay": ...}`.
- `POST /v1/replays/verify` accepts one historical DecisionPacket directly and returns the canonical DecisionReplay. A replay `MISMATCH`, `INVALID_PACKET`, or `UNSUPPORTED_VERSION` remains HTTP 200 because replay validation completed successfully.

Requests must use `application/json` and remain at or below 65,536 bytes. Errors use `{"error":{"code":"...","message":"...","details":[]}}` without stack traces or echoed payloads. Unknown routes return 404, wrong methods 405, malformed JSON 400, unsupported content type 415, and oversized bodies 413.

## Safety Boundary

The API accepts assessed evidence for policy evaluation and performs free registry discovery. It has no private keys, wallets, payment adapters, signing capability, transaction execution, database, or LLM hallucination dependencies.
