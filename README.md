# Nexora

Verify Intelligence. Bound Action.

> **"Intelligence is not a decision. Nexora works out what evidence an autonomous agent needs before it acts. It finds Telegraph miners that can provide that evidence, checks what comes back, and applies deterministic rules to decide what happens next."**

- **Public Web App:** [https://nexora-seven-lemon.vercel.app](https://nexora-seven-lemon.vercel.app)
- **Production API:** [https://nexora-api-3efi.onrender.com](https://nexora-api-3efi.onrender.com)
- **API Health Endpoint:** [https://nexora-api-3efi.onrender.com/health](https://nexora-api-3efi.onrender.com/health)
- **GitHub Repository:** [https://github.com/chyokore/nexora](https://github.com/chyokore/nexora)

Nexora is submitted to the **Telegraph Protocol Hackathon Season I — Track 3: Applications**.

---

## The Problem: Intelligence Is Not a Decision

Autonomous agents increasingly take high-stakes, real-world actions like authorizing supplier payments, interacting with on-chain protocols, or verifying external user claims.

While intelligence networks like Telegraph Protocol supply specialized, multi-miner domain intelligence, **intelligence alone cannot decide an action**:
- A miner can report an answer with 100% confidence and still be wrong or incomplete.
- Unrelated confidence scores cannot be averaged into one artificial trust number.
- Missing or unresolved evidence must never be silently assumed safe to proceed.

Nexora acts as the decision guardrail between raw intelligence providers and autonomous agent execution.

---

## What Nexora Does

1. **Generates Explicit Evidence Requirements:** Takes a question or proposed action, breaks it into explicit evidence requirements, and explains why each one matters.
2. **Filters for Capability Before Payment:** Checks candidate Telegraph miners to verify their output can satisfy the evidence requirement before spending USDC.
3. **Preserves Telegraph Ranking:** Selects the highest-ranked capable miner and acquires real intelligence using x402 on Base Sepolia.
4. **Evaluates Evidence Quality & Conflict:** Checks structural validity, coverage, missing items, and cross-source contradictions without confidence score averaging.
5. **Enforces Bounded Policy:** Applies explicit deterministic policy rules to return a clear conclusion.
6. **Produces Deterministic Decision Replay:** Emits an immutable SHA-256 decision fingerprint and audit trace so any decision can be independently replayed.

---

## Two Product Modes

Nexora supports two complementary operating modes within the Decision Workspace:

### 1. INVESTIGATE
- **Purpose:** Determines whether available evidence is sufficient to support an investigation claim or answer a question.
- **Currently Supported Inputs:** User question, supporting text/claim, URL (triggers `URL_SCAN`), Base Sepolia transaction hash (triggers `ONCHAIN_TX_LOOKUP`).
- **Bounded Conclusion Vocabulary:**
  - `SUPPORTED`: Required evidence questions were satisfied with usable quality.
  - `DISPUTED`: Evidence was contradicted or adversely resolved.
  - `INCONCLUSIVE`: Required evidence was missing, incomplete, or below minimum quality thresholds.

### 2. AUTHORIZE ACTION
- **Purpose:** Determines whether an autonomous agent has enough reliable required evidence to proceed with an irreversible action (e.g. supplier payment authorization).
- **Bounded Decision Vocabulary & Reference Agent States:**
  - `ALLOW` → Reference Agent State: `AUTHORIZED` (All required evidence satisfied; agent proceeds).
  - `REVIEW` → Reference Agent State: `HELD_FOR_REVIEW` (Missing, weak, or contradicted evidence; agent stops safely).
  - `BLOCK` → Reference Agent State: `REJECTED` (Reliable adverse evidence triggered blocking condition; agent rejects action).

*Note: Nexora controls decision authorization. It does not transfer supplier funds or execute arbitrary external on-chain transactions.*

---

## Core Architecture

```text
01 QUESTION             User or agent supplies a question, claim, URL, transaction hash, or action proposal.
        ↓
02 EVIDENCE REQUIREMENTS Nexora generates explicit evidence requirements and explains why each matters.
        ↓
03 EVIDENCE CAPABILITY  Checks whether a miner's declared contract satisfies required evidence BEFORE spending USDC.
        ↓
04 TELEGRAPH + x402     Selects highest-ranked capable provider & acquires intelligence via x402 on Base Sepolia.
        ↓
05 VERIFICATION         Evaluates structural validity, missing items, coverage, and cross-source contradictions.
        ↓
06 POLICY EVALUATION    Applies explicit deterministic policy rules (no confidence score averaging).
        ↓
07 BOUNDED OUTCOME      INVESTIGATE: SUPPORTED · DISPUTED · INCONCLUSIVE
                        AUTHORIZE ACTION: ALLOW · REVIEW · BLOCK
        ↓
08 DECISION REPLAY      Emits SHA-256 fingerprint & deterministic timeline for exact replay verification.
```

---

## Evidence Capability Gate

A primary differentiator in Nexora is the **Pre-Payment Evidence Capability Gate**.

### The Principle
A miner can support the right intent and still return the wrong shape of evidence for a particular decision.

Nexora learned this during production testing. An onchain lookup selected a rank #1 provider by intent, but returned intelligence that did not include the transaction evidence the policy needed, leaving the investigation INCONCLUSIVE despite a successful payment.

The Evidence Capability Gate prevents that avoidable spend. Before initiating an x402 payment, Nexora inspects the candidate miner's declared output contract to verify it contains the structural fields necessary to satisfy the requirement:
- Only miners with matching declared output capability remain eligible.
- Telegraph ranking is strictly preserved among capable miners.
- Nexora **does not** replace or override Telegraph ranking; it filters the candidate set for structural capability first.

---

## Production Findings & Case Studies

### 1. The Contradiction Case: When 100% Confidence Is Wrong
- **Scenario:** During live Telegraph testing, TxLens miner `9002` was queried for an on-chain transaction.
- **Provider Result:** Reported `status: not_found` with `100% confidence (1.0)`.
- **On-Chain Reality:** Independent verification against Base Sepolia proved transaction `0xcd9a...` independently existed in block `46,306,603`.
- **Nexora Action:** Nexora did not let the 100% confidence score settle the question. It marked the evidence as `CONTRADICTED` and safely routed the decision to `REVIEW`.
- **Core Lesson:** High confidence is not verified truth.

### 2. Production Learning: Capability Before Payment
- **Scenario:** During early production testing, an `ONCHAIN_TX_LOOKUP` query selected ChainSight for an onchain lookup.
- **Finding:** ChainSight's returned payload structure did not contain the transaction inclusion fields required by Nexora's canonical transaction evidence policy, resulting in `LIMITED` quality and an `INCONCLUSIVE` verdict despite successful payment.
- **Resolution:** We built the Evidence Capability Gate to inspect candidate miner output schemas before initiating payment. Among capable miners, Telegraph ranking is strictly preserved.
- **Controlled Run Result:** In a subsequent production run, the capability gate selected `TxLens` (miner `9002`), which successfully provided `USABLE` evidence, `SUFFICIENT` coverage, and a `SUPPORTED` conclusion across 1 paid call (0.0100 USDC).

---

## Real Telegraph & x402 Evidence

Nexora operates against real Telegraph Protocol miners on Base Sepolia (`eip155:84532`):

- **FRAUD_DETECTION:** DegenLens (`10002`) · 0.0100 USDC · `/anomaly/check`
- **URL_SCAN:** NetWire URL Scan (`7334`) · 0.0100 USDC · `/url-scan`
- **ONCHAIN_TX_LOOKUP:** TxLens (`9002`) · 0.0100 USDC · `/check-tx`

### Verified On-Chain Settlements & Adoption
- **Original Controlled Smoke:** 3 logical paid calls (`0.0300 USDC` settled across 3 intent types).
- **Community Adoption:** 2 independent external user runs, 2 completed Live Decisions, 4 genuine paid Telegraph calls (`0.0400 USDC` total settled).

---

## Deterministic Decision Replay

Decision Replay provides auditability for every Nexora decision:
- Generates a unique SHA-256 fingerprint from the canonical decision packet.
- Reconstructs an 8-event deterministic timeline from action proposal to final verdict.
- Recomputes the decision state against recorded evidence to confirm `VERIFIED MATCH`.

*Note: Decision Replay checks deterministic integrity (feeding the same recorded evidence to the same policy reproduces the exact same decision). `VERIFIED MATCH` means the recorded and recomputed decisions agree; it does not prove that every external fact is true.*

---

## Three Core Principles

1. **INTELLIGENCE IS NOT A DECISION:** A high-confidence answer can still be incomplete, contradicted, or unsuitable for an action.
2. **CAPABILITY BEFORE PAYMENT:** Nexora checks whether a miner can provide the evidence the decision actually needs before paying it, while preserving Telegraph ranking among capable providers.
3. **UNCERTAINTY BOUNDS ACTION:** Missing, insufficient, or contradicted required evidence cannot silently become authorization.

---

## Safety & Spend Controls

- **Network & Asset Restrictions:** Operates on Base Sepolia (`eip155:84532`) using approved USDC asset only.
- **Bounded Spend:** Maximum 0.03 USDC per run across a maximum of 3 logical paid calls.
- **Server-Side Execution:** Payment signatures are executed server-side; public users cannot specify arbitrary payees, networks, or contract targets.
- **Concurrency & Cooldown:** Bounded concurrency and rate-limiting prevent duplicate authorization runs.
- **Fail-Safe Routing:** If required evidence is missing, a provider fails, or the result cannot meet the policy threshold, Nexora does not guess. The action goes to `REVIEW`.
- **Blast Radius:** The in-process spend guard state resets upon server process restarts; the durable financial blast radius is bounded by the server's burner wallet balance.

---

## Production API Specification

- `GET /health` — API status and configuration check.
- `GET /v1/discovery` — Inspects live Telegraph miner registry without spending USDC.
- `POST /v1/decisions/evaluate` — Evaluates proposed action against evidence assessments.
- `POST /v1/replays/verify` — Replays a recorded decision packet to verify SHA-256 fingerprint integrity.
- `POST /v1/agent/run` — Executes a live AUTHORIZE ACTION decision run with x402 settlement.
- `POST /v1/investigations/run` — Executes a live INVESTIGATE run for claims, URLs, or transaction hashes.

---

## Local Development

```bash
# Clone repository
git clone https://github.com/chyokore/nexora.git
cd nexora

# Run backend suite (250 tests)
cd scripts/telegraph-smoke
npm install
npm test

# Run frontend suite (54 tests)
cd ../../web
npm install
npm test
npm run build
```

---

## Planned Extensions

Nexora's modular evidence architecture is designed to support additional evidence modalities when suitable Telegraph intelligence providers and deterministic evidence contracts are available:
- **Image & Document Evidence:** Verification contracts for image tamper analysis, document authenticity checks, and invoice OCR verification.
- **Video & Stream Evidence:** Point-in-time frame verification and deepfake detection signals.

*Note: Planned extensions represent future architectural directions. Direct image/video file uploads are not supported in the current production submission.*

---

## Hackathon Context

- **Event:** Telegraph Protocol Hackathon Season I
- **Track:** Track 3: Applications
- **Repository:** [https://github.com/chyokore/nexora](https://github.com/chyokore/nexora)
- **Live App:** [https://nexora-seven-lemon.vercel.app](https://nexora-seven-lemon.vercel.app)
