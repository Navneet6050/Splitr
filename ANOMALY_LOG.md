# Anomaly Log

The importer records every detected issue in `importAnomalies` and every user decision in `anomalyReviews`.

## Detected Anomaly Types

| Type | Severity | Handling Policy |
|---|---|---|
| `INVALID_DATE` | blocking | User must correct or skip before approval. |
| `AMBIGUOUS_DATE` | blocking | User must approve the chosen interpretation or skip. |
| `MIXED_DATE_FORMAT` | warning | User can approve after reviewing date parsing. |
| `MISSING_PAYER` | blocking | User must correct or skip. |
| `MISSING_CURRENCY` | blocking | User must correct or skip. |
| `CURRENCY_CONVERSION_REQUIRED` | warning | Import converts to INR and preserves original currency/rate. |
| `INVALID_AMOUNT` | blocking | User must correct or skip. |
| `NEGATIVE_AMOUNT` | blocking | User must decide whether it is a refund/correction or skip. |
| `ZERO_AMOUNT` | warning | User may keep as audit-only row or skip. |
| `SETTLEMENT_LOGGED_AS_EXPENSE` | blocking | User can convert to settlement. |
| `NON_STANDARD_SPLIT_TYPE` | warning | `share` becomes weighted split; `unequal` becomes exact split. |
| `UNKNOWN_SPLIT_TYPE` | blocking | User must correct or skip. |
| `NAME_ALIAS` | warning | Import maps normalized aliases to canonical imported users. |
| `MEMBERSHIP_VIOLATION` | blocking | User must approve exception, correct participant list, or skip. |
| `GUEST_PARTICIPANT` | warning | Import creates/uses guest-style participant and temporary membership. |
| `TEMPORARY_MEMBER` | info | Import records temporary membership context. |
| `DUPLICATE_EXPENSE` | blocking | User must choose keep/skip behavior. |
| `NEAR_DUPLICATE_EXPENSE` | warning | User reviews before approval. |

## CSV-Specific Examples

- Duplicate dinner rows: `Dinner at Marina Bites` and `dinner - marina bites`.
- Settlement row: `Rohan paid Aisha back`.
- USD rows: Goa villa, beach shack lunch, parasailing, refund.
- Alias rows: `priya`, `Priya S`, `rohan `.
- Membership rows: Meera after March, Sam before/after April move-in, Kabir as trip-only participant.
- Non-standard splits: `share`, `unequal`.
