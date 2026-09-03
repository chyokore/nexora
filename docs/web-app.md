# Nexora judge-facing web app

The web app is a submission-grade interface presenting Nexora's deterministic decision engine, live reference decision workflow, live Telegraph discovery inspector, verified settlement evidence gallery, and Decision Replay auditor.

## Public deployments

- **Frontend:** https://nexora-seven-lemon.vercel.app
- **Product API:** https://nexora-api-3efi.onrender.com
- **Health Check:** https://nexora-api-3efi.onrender.com/health
- **Live Discovery:** https://nexora-api-3efi.onrender.com/v1/discovery
- **Live Decision:** https://nexora-api-3efi.onrender.com/v1/agent/run

## Judge Experience Features

1. **30-Second Positioning:** Clear, immediate explanation that *"Intelligence is not a decision. Telegraph provides intelligence. Nexora decides whether an agent has enough reliable evidence to proceed."*
2. **Live Decision Workflow:** Demonstrates a live autonomous agent submitting a proposed supplier payment, acquiring real Telegraph intelligence, evaluating evidence quality, and obeying the deterministic policy decision (`ALLOW`, `REVIEW`, or `BLOCK`). Shows the complete 8-step visual sequence: Agent Proposal → Evidence Needed → Live Telegraph Intelligence → Evidence Quality → Nexora Decision → Agent Response → Why (unresolved conditions) → Decision Replay proof.
3. **Architecture Snapshot:** Interactive, responsive pipeline demonstrating the transition from agent proposal to Telegraph intelligence, evidence quality assessment, deterministic policy, bounded decision, and Decision Replay.
4. **The Contradiction Case Spotlight:** Prominently demonstrates the finding from live Phase 5D audit: TxLens miner reported `status: not_found` with `100% confidence`, but Base Sepolia reality proved the transaction existed. Nexora classified the evidence as `CONTRADICTED` and routed the action to safe `REVIEW`. Demonstrates that high confidence is not verified truth.
5. **Verified Live Evidence Gallery:** Displays the 3 proven live Telegraph purchases with clickable BaseScan links to settlement transaction hashes, blocks, and costs (0.01 USDC each).
6. **Live Telegraph Discovery Inspector:** Real-time query against the free Telegraph registry node, displaying total registered miners and neutral winning selections across `FRAUD_DETECTION`, `URL_SCAN`, `ONCHAIN_TX_LOOKUP`, `FACT_CHECK`, and `NEWS_SEARCH` with zero paid inference.
7. **Decision Evaluator & 4 Scenarios:** Interactive form supporting 4 provenance-badged scenarios (`SUPPORTED`, `FRAUD COVERAGE GAP`, `CONTRADICTED ONCHAIN`, and `VERIFIED ADVERSE`).
8. **Decision Replay:** Full audit view with SHA-256 fingerprint, one-click copy, recorded vs recomputed decision comparison, 8-event timeline, and collapsible raw Decision Packet JSON.

## Safety Boundary

The evaluator uses sanitized fixtures to demonstrate policy and replay without initiating paid miner calls or exposing wallet credentials. Live decision runs are rate-limited to 1 per minute per client, max 3 paid calls per decision, max 0.03 USDC total cost, and operate under a process spend guard, burner wallet balance ceiling, and emergency disable switch. The browser contains no wallet connection, private keys, transaction execution, or hidden decision fallbacks.

## Local Development

Terminal 1 (Backend API):
```powershell
cd scripts/telegraph-smoke
npm run start:api
```

Terminal 2 (Frontend):
```powershell
cd web
npm run dev
```
Open `http://127.0.0.1:5173/`.
