# Telegraph controlled smoke harness

This isolated TypeScript utility prepares Nexora's three-call Telegraph verification. Its default mode fetches only the free registry, applies the ownership-blind selection rule, builds three harmless requests, prints the plan, and stops. The x402 signer is isolated behind a lazy adapter and is never initialized by default.

```powershell
npm install
npm run test
npm run dry-run
```

An explicitly authorized future pre-payment inspection can make exactly one unsigned request, require HTTP 402, display public challenge metadata, validate it, and stop without retrying:

```powershell
node dist/src/cli.js --inspect-challenge --logical-test-id fraud-smoke-001 --approved-asset 0x...
```

This command was not run in Phase 3B. Supplying no approved asset causes validation to stop at the asset-approval gate.

The future controlled payment path requires an unmistakable opt-in:

```powershell
node dist/src/cli.js --execute-paid --logical-test-id fraud-smoke-001 --approved-asset 0x...
```

That flag requires a locally supplied `TELEGRAPH_EVM_PRIVATE_KEY`, exact `EVM_NETWORK=eip155:84532`, a recognized logical test ID, and an explicitly approved live-challenge asset. It first performs an unsigned challenge inspection and all policy/ledger checks; only then can the official EVM signer adapter initialize. Do not run it without separate authorization, and never place secrets in arguments, output, this directory, or Git.

`CaptureRecord` and domain-specific evidence types exclude private keys, seed phrases, secret headers, and raw payment signatures. Limits are exactly three logical purchases, 10,000 micro-USDC each and 30,000 total; the ordinary initial-402/paid-retry negotiation remains one logical purchase.
