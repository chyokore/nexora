# Nexora

The Decision Layer for Autonomous Agents.

> **"Intelligence tells an agent what is happening. Nexora decides what the agent should do next."**

- **Public Web App:** https://nexora-seven-lemon.vercel.app
- **Product API Health:** https://nexora-api-3efi.onrender.com/health
- **Live Discovery Endpoint:** https://nexora-api-3efi.onrender.com/v1/discovery

Nexora is a **Telegraph Protocol Hackathon Season I — Track 3: Applications** submission.

---

## Why Nexora?

Autonomous agents increasingly execute irreversible real-world actions (e.g. supplier payments, contract calls, asset transfers). While intelligence networks like Telegraph Protocol provide multi-miner domain intelligence, **agents cannot blindly trust raw confidence scores or assume that missing evidence is safe**.

Nexora bridges intelligence and action execution:
1. **Neutrally selects** specialized Telegraph miners across Fraud, URL, and On-chain intents.
2. **Normalizes domain-specific evidence** while rigorously preserving uncertainty, missing fields, and contradictions.
3. **Applies deterministic action policy** to produce explicit `ALLOW`, `REVIEW`, or `BLOCK` verdicts without LLM hallucinations.
4. **Generates Decision Replay** with verifiable SHA-256 fingerprinting and an 8-event timeline explaining why the decision was made.

---

## Architecture

```text
Proposed Action (e.g. Supplier Payment)
        ↓
Telegraph Protocol Intelligence (Neutral Miners)
        ↓
Evidence Assessment (Structural Validity · Coverage · Contradictions)
        ↓
Deterministic Action Policy (No Confidence Averaging)
        ↓
ALLOW / REVIEW / BLOCK
        ↓
Decision Replay (SHA-256 Audit Fingerprint · 8-Event Timeline)
```

---

## Proven Live Settlements & Boundaries

Nexora has already executed and verified 3 live Telegraph x402 purchases on Base Sepolia (`eip155:84532`):
- **FRAUD_DETECTION:** DegenLens (`10002`) · `0.01 USDC` · Block `46,306,281` (Tx `0x1a26240e...`)
- **URL_SCAN:** NetWire URL Scan (`7334`) · `0.01 USDC` · Block `46,306,603` (Tx `0xcd9a4af2...`)
- **ONCHAIN_TX_LOOKUP:** TxLens (`9002`) · `0.01 USDC` · Block `46,307,152` (Tx `0x173cd26c...`)

**The Contradiction Finding:** During live lookup, miner `9002` reported `status: not_found` with `100% confidence` for a transaction that independently existed on Base Sepolia. Nexora preserved the raw response, classified the evidence quality as `CONTRADICTED`, and routed the action to safe `REVIEW`. High confidence is not verified truth.

---

## Documentation

- [Deployment and live verification](docs/deployment.md)
- [Judge-facing Web App guide](docs/web-app.md)
- [Product API specification](docs/product-api.md)
- [Evidence Quality policy](docs/evidence-quality-policy.md)
- [Action Decision policy](docs/action-decision-policy.md)
- [Deterministic Decision Replay](docs/decision-replay.md)
- [Telegraph Runtime audit](docs/telegraph-runtime-audit.md)
- [Telegraph Contract compatibility matrix](docs/telegraph-contract-compatibility-matrix.md)
