# Deterministic action policy and Decision Packet

Nexora's decision path is:

`Telegraph → normalization → verification → EvidenceAssessment → Action Policy → ActionDecision → DecisionPacket → future Decision Replay`

The Action Policy does not decide whether a provider is correct. It receives already assessed evidence and decides what the proposed autonomous action may do. It has no transport, payment, wallet, execution, provider-specific, confidence-threshold, or AI dependency.

## Supplier-payment MVP

`SUPPLIER_PAYMENT_AUTHORIZATION` is a proposed action only. Fraud evidence is mandatory. URL evidence is mandatory when the proposal identifies a supplier URL. On-chain transaction evidence is added only when the proposal already has a transaction hash; it is not forced into a pre-payment proposal.

Each requirement is evaluated independently against a minimum bounded quality and an explicit favorable finding. Evidence quality alone is not favorable evidence: merely lacking a negative finding cannot satisfy a requirement. Evidence and confidence are never averaged, and unrelated strong evidence cannot compensate for a missing mandatory intent. Provider confidence remains replay data and has no action-policy precedence.

- `ALLOW`: every mandatory requirement is independently satisfied and no explicit blocking rule matches.
- `REVIEW`: required evidence is missing, invalid, insufficient, below minimum quality, or contradicted.
- `BLOCK`: independently verified usable/strong evidence contains a finding explicitly configured as blocking, or a requirement explicitly configures contradiction as blocking.

`REVIEW` is not failure. It is Nexora refusing to manufacture certainty. Missing or weak evidence cannot create `BLOCK`; that decision requires an explicit policy condition.

## Replay foundation

Decision Packet version 1 records the decision ID, proposed action, sorted assessed evidence, exact policy snapshot, and deterministic action result. It explains the proposal, required and available evidence, assigned quality, contradictions or missing evidence, satisfied and unresolved requirements, policy rule, decision, and reasons. It intentionally excludes raw responses, private keys, authorization signatures, payment credentials, and execution capability.

The tests include sanitized captured-live behavior for out-of-coverage fraud and contradicted on-chain evidence, plus a clearly marked synthetic verified adverse fixture solely for the `BLOCK` policy path. They perform no live operations.
