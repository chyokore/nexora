# Telegraph controlled smoke harness

This isolated TypeScript utility prepares Nexora's three-call Telegraph verification. Its default mode fetches only the free registry, applies the ownership-blind selection rule, builds three harmless requests, prints the plan, and stops. It has no x402 or signing dependency.

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

The reserved future payment gate is intentionally incomplete in Phase 3B:

```powershell
node dist/src/cli.js --allow-payment --logical-test-id fraud-smoke-001 --approved-asset 0x...
```

That flag requires a locally supplied `TELEGRAPH_EVM_PRIVATE_KEY`, a logical test ID, and an explicitly approved asset, then stops with `PAYMENT_EXECUTOR_NOT_INSTALLED`. Do not place secrets in arguments, output, this directory, or Git. A later separately authorized phase must install and review the signing adapter before the command can pay.

The future response record shape is declared as `CaptureRecord`; it excludes private keys, seed phrases, and payment signatures. Contract results remain unclassified until real responses exist.
