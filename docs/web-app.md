# Nexora judge-facing web app

The web app is a deliberately narrow interface over the existing Phase 6D Product API. The browser proposes a supplier-payment authorization and sends selected, sanitized evidence assessments to `POST /v1/decisions/evaluate`. It never computes an action decision locally. `ALLOW`, `REVIEW`, or `BLOCK`, the packet fingerprint, and the replay all come from the canonical backend.

## Local judge demo

Use Node.js 18 or newer. In terminal one:

```powershell
cd scripts/telegraph-smoke
npm install
npm run start:api
```

In terminal two:

```powershell
cd web
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. Vite proxies `/api` to `http://127.0.0.1:3000`. To use a separately hosted API, copy `.env.example` to an ignored `.env.local` and set `VITE_NEXORA_API_URL` to its public base URL. Only `VITE_` variables are exposed to the browser; never put secrets in them.

## Judge flow

1. Review or edit the proposed supplier payment.
2. Choose one of four clearly labeled fixture-backed evidence conditions.
3. Evaluate and observe the Product API's prominent decision.
4. Compare provider confidence with Nexora's evidence quality and coverage.
5. Open Decision Replay to inspect validation, packet fingerprint, recorded/recomputed decision, and the ordered timeline.

The four conditions deterministically demonstrate `ALLOW`, coverage-gap `REVIEW`, contradicted-evidence `REVIEW`, and verified-adverse `BLOCK`.

Fixture provenance is always visible: supported evidence uses a sanitized boundary fixture, coverage-gap and onchain contradiction cases are live-derived sanitized fixtures, and the adverse case is an explicitly synthetic policy test. None is presented as a live request.

## Safety boundary

The app uses sanitized fixtures only. It does not call Telegraph or miners, negotiate x402, sign, pay, settle, fund a wallet, write onchain, persist user data, or execute the proposed payment. API failures are displayed directly; the browser has no hidden decision fallback. The replay correctly reports post-decision outcome as `NOT_RECORDED`.

## Verification

Run `npm test`, `npm run type-check`, and `npm run build` in `web`. Run `npm test`, `npm run build`, and `npm run dry-run` in `scripts/telegraph-smoke` to verify the canonical backend and offline boundary.

## Deployment sequence (future phase)

No deployment occurs in Phase 6E. A later verified phase can deploy the static Vite frontend to Vercel, deploy the Node Product API to Render, configure `VITE_NEXORA_API_URL` at frontend build time, restrict backend CORS to the final frontend origin, and then repeat all four browser journeys against those public endpoints. Live Telegraph acquisition should be integrated only after deployment health, observability, budget controls, and secret isolation are independently verified.
