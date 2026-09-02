# Live Telegraph smoke evidence

## Phase 5A: unsigned FRAUD_DETECTION preflight

Timestamp: `2026-09-02T19:31:44.255Z`

- **VERIFIED LIVE:** The free dispatcher returned 129 registrations and 6 neutrally eligible FRAUD_DETECTION miners.
- **VERIFIED LIVE:** Neutral selection chose DegenLens On-Chain Intelligence, miner `10002`, rank 1, score 1, advertised price 10,000 micro-units, using `GET /transaction/lookup` with the query-only input contract.
- **VERIFIED FROM RESPONSE:** Logical call `fraud-smoke-001` received HTTP 402 with x402 version 2, scheme `exact`, network `eip155:84532`, asset `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, amount `10000`, and payee `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8`.
- **UNAVAILABLE:** The challenge did not expose a validity/expiry, resource, or description through the parsed response fields.
- **VERIFIED FROM RESPONSE:** The challenge passed validation-only scheme, network, address, amount, payee, miner, logical-ID, and redirect/target checks. Treating the observed asset as validation input did not approve it for signing.
- **VERIFIED FROM BASE SEPOLIA:** Chain ID 84532; challenge asset contract bytecode exists (1,798 bytes); token metadata is name `USDC`, symbol `USDC`, decimals 6.
- **VERIFIED FROM BASE SEPOLIA:** Burner `0x63D00Cfa1f73765bF94013294278E429868803eC` has 0 ETH and 0 USDC. The 0.01 USDC challenge amount is therefore **INSUFFICIENT**.
- **VERIFIED LIVE:** Payment signatures 0; paid retries 0; settlements 0; blockchain writes 0.

Execution stopped before authorization. The challenge asset has not been approved.
