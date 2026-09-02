# Nexora

The Decision Layer for Autonomous Agents.

**Public demo:** https://nexora-seven-lemon.vercel.app

**API health:** https://nexora-api-3efi.onrender.com/health

Telegraph intelligence tells autonomous agents what is happening. Nexora is being built to evaluate independent Telegraph intelligence, preserve agreement, conflict, missing evidence, and uncertainty, and eventually return a bounded decision:

- ALLOW
- REVIEW
- BLOCK

Each decision is intended to include an inspectable Decision Replay explaining the evidence and policy outcome.

Nexora is a **Telegraph Protocol Hackathon Season I — Track 3: Applications** project.

## Architecture

```text
Propose
→ Intelligence Evidence
→ Evidence Assessment
→ Policy
→ ALLOW / REVIEW / BLOCK
→ Decision Replay
```

## Public demo

The current public experience uses sanitized, deterministic fixtures so judges can inspect evidence assessment, policy outcomes, and replay verification without wallets or paid calls. Live Telegraph/x402 acquisition is intentionally disconnected.

- [Deployment and verification](docs/deployment.md)
- [Telegraph runtime audit](docs/telegraph-runtime-audit.md)
- [Telegraph contract compatibility matrix](docs/telegraph-contract-compatibility-matrix.md)
