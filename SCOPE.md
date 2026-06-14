# Scope

## Implemented

- Additive Convex schema extensions for imports, staged rows, anomalies, reviews, aliases, memberships, currency rates, reports, and normalized expense splits.
- `/import` page for CSV upload, staged preview, anomaly review, approval, commit, and report viewing.
- Modular detector logic inside `convex/imports.js` for:
  - duplicate and near-duplicate expenses
  - mixed and ambiguous date formats
  - missing payer
  - missing currency
  - USD conversion
  - negative and zero amounts
  - settlement-like rows
  - aliases
  - membership violations
  - temporary and guest participants
  - non-standard split types
- Weighted-share import handling for `share`.
- Unequal import handling by converting to exact split amounts.
- INR base-currency conversion with original amount/currency/rate preserved.
- Historical membership records for imported participants.
- Import report JSON persisted in Convex.
- Balance drilldown query for explaining pairwise balances.

## Preserved

- Existing auth flow.
- Existing manual group, expense, and settlement flows.
- Existing embedded expense `splits` so current UI continues to work.

## Known Limits

- Exchange rate policy uses a fixed USD to INR rate for assignment auditability. A production version would load dated rates from an external provider and store the source.
- PDF export is designed as a PDF-friendly report view; server-side PDF generation is intentionally avoided.
- Correction values are stored in review records, but this first implementation primarily supports approve, skip, and settlement conversion decisions from the UI.
