# Nexora product API foundation

Phase 6D exposes the deterministic decision core through a small built-in Node HTTP service without moving the existing modules or adding a framework.

```text
Future Vercel Web App
        ↓
Nexora Product API
        ↓
Decision Core
 ├─ Evidence Assessment
 ├─ Action Policy
 ├─ Decision Packet
 └─ Decision Replay
```

The future live path remains separate and is not wired in this phase:

```text
Nexora Product API
        ↓
Telegraph Intelligence Adapter
        ↓
x402 Payment Boundary
```

Start locally from `scripts/telegraph-smoke` with `npm run start:api`. The service uses `PORT` when supplied and otherwise listens on port 3000. It starts without wallet credentials.

## Endpoints

- `GET /health` returns `{"status":"ok","service":"nexora-api","version":"1"}`.
- `POST /v1/decisions/evaluate` accepts exactly `{"proposedAction": ProposedAction, "evidenceAssessments": EvidenceAssessment[]}`. It rejects client policy fields, constructs the canonical supplier-payment policy and deterministic DecisionPacket, replays it independently, and returns `{"decisionPacket": ..., "decisionReplay": ...}`.
- `POST /v1/replays/verify` accepts one historical DecisionPacket directly and returns the canonical DecisionReplay. A replay `MISMATCH`, `INVALID_PACKET`, or `UNSUPPORTED_VERSION` remains HTTP 200 because replay validation completed successfully.

Requests must use `application/json` and remain at or below 65,536 bytes. Errors use `{"error":{"code":"...","message":"...","details":[]}}` without stack traces or echoed payloads. Unknown routes return 404, wrong methods 405, malformed JSON 400, unsupported content type 415, and oversized bodies 413.

Example sanitized evaluation request:

```json
{"proposedAction":{"id":"proposal-1","type":"SUPPLIER_PAYMENT_AUTHORIZATION","description":"Evaluate a proposed supplier payment.","subject":{"kind":"SUPPLIER_PAYMENT","reference":"supplier-1"},"riskClass":"HIGH"},"evidenceAssessments":[]}
```

The service accepts assessed evidence only—not raw Telegraph responses—and owns policy selection. It has no database, authentication, wallet, signing, payment, live miner, transaction execution, UI, deployment, or LLM integration. The demo scenarios endpoint is intentionally deferred to avoid coupling production service code to test fixtures.
