# Import & Anomaly System

This document summarizes the CSV import, anomaly detection, review, and commit pipeline implemented in the app.

Key files:
- `convex/schema.js` — collections for `imports`, `importRows`, `importAnomalies`, `anomalyReviews`, `currencyRates`, etc.
- `convex/imports.js` — core lifecycle: `create`, `reviewAnomaly`, `approve`, `commit`, `redetect`.
- `convex/import/detectors/*` — modular detectors.
- `app/(main)/import/page.jsx` — import UI with stage, review, approve, commit, export.
- `convex/currency.js` — FX lookups and provenance.
- `convex/memberships.js` — membership event API.
- `app/(main)/memberships/manage/page.jsx` — membership editor and re-detect action.

How to use
1. Upload CSV via Import page and stage rows.
2. Review anomalies and correct/skip/convert as needed.
3. Approve then Commit to create canonical `expenses`/`settlements`.
4. If memberships need adjustment, use Memberships page to add membership events, then press "Re-detect imports" to refresh anomalies.
5. Export import reports from the Import page as JSON/CSV.

Notes
- Currency rates are stored in `currencyRates`. Seeded sample rates are available via `convex/seed.js:seedCurrencyRates`.
- The `redetect` mutation re-runs detectors for an import and replaces previous anomalies.
- Rounding for splits uses 2-decimal rounding with adjustment on the last split to ensure totals match.

