# Public deployment

Nexora's public, judge-facing demo is deployed as two independently built services:

```text
Public browser
  → Nexora web app on Vercel
  → HTTPS Product API on Render
  → Deterministic Nexora core
```

- Web app: https://nexora-seven-lemon.vercel.app
- Product API: https://nexora-api-3efi.onrender.com
- Health check: https://nexora-api-3efi.onrender.com/health

## Render API

Render builds from `scripts/telegraph-smoke/` with:

```sh
npm install --package-lock=false && npm run build
```

It starts the API with:

```sh
node dist/src/api-cli.js
```

Render supplies `PORT`. `NODE_VERSION` selects the Node.js runtime, and `CORS_ALLOWED_ORIGINS` contains the exact Vercel production origin. The API also allows the two explicit local Vite origins used during development. Wildcards and arbitrary reflected origins are rejected.

The API does not require or receive a Telegraph private key, burner credential, payment authorization, or production wallet configuration. Request logging is limited to request ID, method, route, status, and duration.

## Vercel web app

Vercel builds from `web/` with `npm ci` and `npm run build`, publishing `dist/`. The public `VITE_NEXORA_API_URL` build variable is:

```text
https://nexora-api-3efi.onrender.com
```

No secret is placed in a `VITE_*` variable or shipped to the browser.

## Verification

The public deployment is checked for API health, four deterministic decision scenarios (ALLOW, coverage-gap REVIEW, contradiction REVIEW, and synthetic BLOCK), valid and tampered replay verification, safe malformed-request behavior, browser console/runtime errors, responsive layouts, keyboard operation, and secret exposure.

The current demo evidence is fixture-backed and sanitized. It is designed to demonstrate deterministic evidence assessment, action policy, and Decision Replay without initiating live Telegraph miner calls, x402 authorization, wallet signing, settlements, or blockchain writes. Live Telegraph integration is intentionally not enabled in this deployment.
