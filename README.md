# Nexora

The Decision Layer for Autonomous Agents.

Telegraph intelligence tells autonomous agents what is happening. Nexora is being built to evaluate independent Telegraph intelligence, preserve agreement, conflict, missing evidence, and uncertainty, and eventually return a bounded decision:

- ALLOW
- REVIEW
- BLOCK

Each decision is intended to include an inspectable Decision Replay explaining the evidence and policy outcome.

Nexora is a **Telegraph Protocol Hackathon Season I — Track 3: Applications** project.

## Architecture concept

```text
Proposed Action
→ Telegraph Intelligence
→ Evidence Normalization
→ Agreement / Conflict / Uncertainty
→ Deterministic Decision Policy
→ ALLOW / REVIEW / BLOCK
→ Decision Replay
```

## Current status

Nexora is in discovery and runtime verification. The live Telegraph miner registry has been inspected, and routing behavior and miner contracts have been audited. Paid x402 inference has not yet been executed, and application implementation has not begun.

- [Telegraph runtime audit](docs/telegraph-runtime-audit.md)
- [Telegraph contract compatibility matrix](docs/telegraph-contract-compatibility-matrix.md)
