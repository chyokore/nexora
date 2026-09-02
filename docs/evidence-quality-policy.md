# Evidence quality policy

Nexora separates four statements that must not be collapsed:

`Telegraph response` ≠ `verified fact` ≠ `Nexora evidence quality` ≠ `Nexora action decision`.

Phase 6A implements only the evidence-quality layer. It does not produce `ALLOW`, `REVIEW`, or `BLOCK` decisions.

## Architecture

Intent-specific normalization preserves provider facts in `FraudEvidence`, `UrlSafetyEvidence`, or `OnchainTransactionEvidence`. A small intent adapter derives coverage and domain-scoped uncertainty. The provider-neutral evaluator then combines structural validity, coverage, and independent verification using deterministic precedence. Provider confidence is copied exactly when present but never ranks quality.

The serializable `EvidenceAssessment` records intent, structural validity, coverage, verification, optional provider confidence, bounded quality, reasons, uncertainties, contradictions, and missing evidence. Fixed property order plus sorted, deduplicated explanatory arrays make identical inputs replay to byte-equivalent JSON.

Precedence is: invalid or unadapted mismatched structure → `INVALID`; independently contradicted facts → `CONTRADICTED`; out-of-coverage evidence → `INSUFFICIENT`; unknown or partial coverage → `LIMITED`; sufficient verified evidence → `STRONG`; sufficient partially verified or unverified provider evidence → `USABLE`. Non-empty contradiction details force the verification state to `CONTRADICTED`, preventing internally inconsistent usable output. `COMPATIBLE_WITH_ADAPTER` is usable because that state represents an explicitly validated adapter. Confidence does not alter this order.

## Sanitized live-case motivation

The fraud fixture preserves an out-of-coverage response and confidence 0. Its assessment is `OUT_OF_COVERAGE`, `NOT_APPLICABLE`, and `INSUFFICIENT`; no fraud or safety fact is invented.

The URL fixture preserves a supported low-risk point-in-time scan, confidence 0.93, HTTP observations, named checked feeds, and empty listings. It is usable provider evidence, while explicitly retaining finite-coverage, point-in-time, and no-future-guarantee uncertainty. Empty listings mean only that the named checks returned none at scan time.

The on-chain fixture preserves a schema-valid `not_found` response and confidence 1 alongside an independently established transaction-existence contradiction. Its assessment retains confidence 1 but is `CONTRADICTED`. This is a neutral record of differing observed evidence, not a characterization of the provider.

These captured/sanitized live-response fixtures exist only for deterministic local tests. They do not make network calls, authorize payments, sign messages, settle payments, or write to a blockchain.
