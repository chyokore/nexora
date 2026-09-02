# Deterministic Decision Replay

A Decision Packet and a Decision Replay have different trust roles.

- A **Decision Packet** is recorded historical decision material: proposal, evidence assessments, policy snapshot, and recorded result.
- A **Decision Replay** independently validates and reconstructs that material. It treats the recorded `actionDecision` as a claim to check, never as authority.

The complete flow is:

`Proposed Action → Required Evidence → Telegraph Intelligence → Normalization → Evidence Assessment → Action Policy → recorded ActionDecision → DecisionPacket → replay recalculation → integrity comparison → replay timeline`

Replay format version 1 supports Decision Packet version 1 and supplier-payment policy snapshot version 1. Missing or malformed packet versions return `INVALID_PACKET`; unknown future versions return `UNSUPPORTED_VERSION`. No coercion or repair occurs.

## Integrity and reconstruction

Replay runtime-validates the action, every evidence assessment, the recorded policy requirements, and all ActionDecision fields. It then calls the canonical `evaluateRecordedPolicy` implementation with the recorded action, assessments, and exact policy snapshot. It compares the decision enum, reasons, satisfied and unsatisfied requirements, blocking evidence, and review evidence after deterministic ordering. Any difference returns `MISMATCH`, including cases where the top-level decision still agrees.

A canonical, sanitizer-bounded SHA-256 fingerprint provides stable packet identity for export and audit foundations. It is local integrity metadata—not blockchain attestation, anchoring, or a claim that the packet is immutable.

## Structured timeline

Valid replay emits eight ordered events: action proposed, evidence required, evidence assessed, contradiction or gap, policy evaluated, decision recorded, decision recomputed, and replay verified/mismatched. Events contain fixed summaries and structured details rather than generated prose or runtime timestamps.

The timeline retains the three sanitized live-derived evidence conditions: supported but bounded URL evidence, insufficient/out-of-coverage fraud evidence, and contradicted on-chain evidence. Provider confidence remains visible but is never decision authority. The synthetic verified adverse fixture remains explicitly identified as a policy test and demonstrates that `BLOCK` requires a configured verified adverse condition.

## Display boundary

Replay recursively redacts fields whose names indicate private keys, seed phrases, authorization/payment signatures, bearer/API secrets, raw environment values, or credentials. Public transaction hashes and addresses remain visible. Invalid packets produce deterministic typed failure results rather than stack traces.

Decision-time packets do not contain a post-decision outcome. Replay reports `NOT_RECORDED`; tracking “what happened next” is future work and is never fabricated.

Phase 6C is offline: it does not contact Telegraph miners, negotiate x402, access wallets, sign, settle, write to a blockchain, render UI, or deploy.
