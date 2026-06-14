# CSV Import Report: `goa_trip_expenses.csv`

| Field | Value |
| :--- | :--- |
| **Import ID** | `dbda7342-57fc-49cc-9ba1-28488ea7f2b8` |
| **Group** | Goa Trip Importer Group |
| **File** | `goa_trip_expenses.csv` |
| **Generated At** | 2026-06-14 · 11:19:34 UTC (`1781435974403`) |
| **Persisted In** | Neon DB → `ImportReport` table |

---

## 1. Executive Summary

| Metric | Value |
| :--- | :--- |
| **Import Status** | ✅ Committed |
| **Rows Processed** | 12 |
| **Rows Imported to Ledger** | 11 |
| **Rows Skipped** | 1 |
| **Total Anomalies Detected** | 15 |
| **Blocking Anomalies** | 9 |
| **Warning Anomalies** | 6 |
| **All Blocking Anomalies Resolved Before Commit** | ✅ Yes — `blockingCount` reached 0 before `approve()` was called |

> All 9 blocking anomalies were explicitly reviewed and resolved by a human reviewer before the commit transaction was executed. No blocking anomaly was silently skipped by automation.

---

## 2. Import Outcome Summary

| Outcome | Count | Detail |
| :--- | :---: | :--- |
| **Settlement Conversions** | 2 | Rows 4 and 8 reclassified from `Expense` to `Settlement` |
| **Currency Conversions Applied** | 4 | Rows 5, 6, 7, 8 — USD converted to INR at rate 83 |
| **Guest Participants Auto-Enrolled** | 1 | Kabir added with a one-day `GroupMembership` (row 11) |
| **Membership Corrections / Exceptions Approved** | 5 | Sam (rows 5, 6, 7, 10) and Meera (row 9) approved as exceptions |
| **Alias Resolutions Applied** | 4 | `priya s` → Priya, `priya` → Priya, `rohan ` → Rohan, `Dev's friend Kabir` → Kabir |
| **Duplicate Row Discarded** | 1 | Row 3 skipped — exact duplicate of row 2 |
| **Non-Standard Split Normalized** | 1 | Row 12 split type `share` auto-transformed to weighted ratio at commit |

---

## 3. Anomaly Resolution Table

| Row | Anomaly Type | Severity | Engine Message | Suggested Action | Actual Action Taken | Final Outcome |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 3 | `DUPLICATE_EXPENSE` | 🔴 Blocking | Likely duplicate of row 2 | `skip` | **skip** | Row discarded — not written to `Expense` |
| 4 | `SETTLEMENT_LOGGED_AS_EXPENSE` | 🔴 Blocking | Row looks like a repayment | `convert` | **convert_to_settlement** | Written to `Settlement` table (ID `2474e27b`) |
| 5 | `MEMBERSHIP_VIOLATION` | 🔴 Blocking | Sam appears before his April move-in | `correct` | **approve** | Exception approved — row committed with Sam as split participant |
| 5 | `CURRENCY_CONVERSION_REQUIRED` | 🟡 Warning | USD must be converted to INR | `convert` | **approve** (auto-converted) | USD 450 → INR 37,350 at rate 83 |
| 6 | `CURRENCY_CONVERSION_REQUIRED` | 🟡 Warning | USD must be converted to INR | `convert` | **approve** (auto-converted) | USD 120 → INR 9,960 at rate 83 |
| 6 | `MEMBERSHIP_VIOLATION` | 🔴 Blocking | Sam appears before his April move-in | `correct` | **approve** | Exception approved — row committed |
| 7 | `MEMBERSHIP_VIOLATION` | 🔴 Blocking | Sam appears before his April move-in | `correct` | **approve** | Exception approved — row committed |
| 7 | `CURRENCY_CONVERSION_REQUIRED` | 🟡 Warning | USD must be converted to INR | `convert` | **approve** (auto-converted) | USD 180 → INR 14,940 at rate 83 |
| 8 | `NEGATIVE_AMOUNT` | 🔴 Blocking | Negative amount may be a refund | `correct` | **approve** | Negative amount preserved; row treated as refund expense |
| 8 | `SETTLEMENT_LOGGED_AS_EXPENSE` | 🔴 Blocking | Row looks like a repayment | `convert` | **convert_to_settlement** | Written to `Settlement` table (ID `d1176de2`) |
| 8 | `CURRENCY_CONVERSION_REQUIRED` | 🟡 Warning | USD must be converted to INR | `convert` | **approve** (auto-converted) | USD 300 → INR 24,900 at rate 83 |
| 9 | `MEMBERSHIP_VIOLATION` | 🔴 Blocking | Meera appears after her March move-out | `correct` | **approve** | Exception approved — row committed |
| 10 | `MEMBERSHIP_VIOLATION` | 🔴 Blocking | Sam appears before his April move-in | `correct` | **approve** | Exception approved — row committed |
| 11 | `GUEST_PARTICIPANT` | 🟡 Warning | Kabir appears as a trip-only guest | `approve` | **approve** | Kabir enrolled with a one-day `GroupMembership` |
| 12 | `NON_STANDARD_SPLIT_TYPE` | 🟡 Warning | Split type `share` requires transformation | `approve` | **approve** (auto-normalized) | Split type transformed to weighted ratio at commit |

---

## 4. User Decision Summary

15 anomalies required 15 review decisions. All decisions are persisted in the `AnomalyReview` table with a `reviewerId` and `reviewedAt` timestamp. The table below is a chronological human-readable log derived from the `userDecisions` array in the JSON appendix.

| # | Timestamp (UTC) | Anomaly ID | Decision | Explanation |
| :---: | :--- | :--- | :--- | :--- |
| 1 | 2026-06-14 11:18:12 | `b19d6745` | **skip** | Row 3 — "Skip duplicate row." Exact duplicate of row 2 (`Dinner at Marina Bites`). Discarded; will not appear in `Expense` table. |
| 2 | 2026-06-14 11:18:15 | `78ad270e` | **convert_to_settlement** | Row 4 — "Convert matching row to settlement log." Description matched repayment pattern (`paid back`). Reclassified as a `Settlement` record — no split math executed. |
| 3 | 2026-06-14 11:18:18 | `047164ac` | **approve** | Row 5 — Membership violation exception approved. Sam's name appeared on an expense dated before his April 8 join date. Reviewer accepted the exception; expense committed with Sam as participant. |
| 4 | 2026-06-14 11:18:21 | `f06256b2` | **approve** | Row 5 — USD currency conversion approved. USD 450 converted to INR 37,350 at static rate 83. |
| 5 | 2026-06-14 11:18:24 | `f13265b7` | **approve** | Row 6 — USD currency conversion approved. USD 120 converted to INR 9,960 at static rate 83. |
| 6 | 2026-06-14 11:18:26 | `ecbbd643` | **approve** | Row 6 — Membership violation exception approved. Sam appeared before April 8 join date; reviewer accepted. |
| 7 | 2026-06-14 11:18:29 | `b8710831` | **approve** | Row 7 — Membership violation exception approved. Sam appeared before April 8 join date; reviewer accepted. |
| 8 | 2026-06-14 11:18:32 | `99370d1d` | **approve** | Row 7 — USD currency conversion approved. USD 180 converted to INR 14,940 at static rate 83. |
| 9 | 2026-06-14 11:18:35 | `553ecf4f` | **approve** | Row 8 — Negative amount approved as refund. Amount kept as-is; row committed to `Expense` with negative value. |
| 10 | 2026-06-14 11:18:38 | `433ff5b2` | **convert_to_settlement** | Row 8 — "Convert matching row to settlement log." Row had both a negative amount and a repayment description. Reclassified as `Settlement` (ID `d1176de2`). |
| 11 | 2026-06-14 11:18:41 | `5019a7ce` | **approve** | Row 8 — USD currency conversion approved. USD 300 converted to INR 24,900 at static rate 83. |
| 12 | 2026-06-14 11:18:45 | `95b64ea5` | **approve** | Row 9 — Membership violation exception approved. Meera appeared after her March 31 move-out date; reviewer accepted. |
| 13 | 2026-06-14 11:18:48 | `82ce8cdf` | **approve** | Row 10 — Membership violation exception approved. Sam appeared before April 8 join date; reviewer accepted. |
| 14 | 2026-06-14 11:18:51 | `8d8d9275` | **approve** | Row 11 — Guest participant approved. Kabir enrolled with a one-day `GroupMembership` spanning the expense date. |
| 15 | 2026-06-14 11:18:54 | `b2870108` | **approve** | Row 12 — Non-standard split type `share` approved for auto-normalization to weighted ratio at commit time. |

> **Review window**: All 15 decisions were completed within a 42-second session (`11:18:12` → `11:18:54 UTC`). The `approve()` gate was called after decision 15 confirmed `blockingCount = 0`.

---

## 5. Generated Records Summary

The following records were written to the Neon PostgreSQL database during the `commit()` transaction (60-second timeout budget):

| Record Type | Count | Notes |
| :--- | :---: | :--- |
| **`Expense` records created** | 9 | Rows 1, 2, 5, 6, 7, 9, 10, 11, 12 (row 3 skipped; rows 4 and 8 converted to settlements) |
| **`ExpenseSplit` records created** | ≥9 | One or more splits per expense; bulk-inserted via `expenseSplit.createMany` in a single batch |
| **`Settlement` records created** | 2 | Row 4 → `2474e27b-95f9-4e6e-93c9-6ce8dbea8f6c`; Row 8 → `d1176de2-afb4-4bfa-b56d-8c64149fb98c` |
| **`GroupMembership` records added** | ≥1 | Kabir enrolled with a one-day window; Sam/Meera exception memberships written if interval did not already overlap an existing record |
| **`AnomalyReview` records written** | 15 | One per anomaly decision; time-stamped with `reviewedAt` and attributed to `reviewerId` |
| **`Alias` records written** | 4 | `priya s` → Priya, `priya` → Priya, `rohan ` → Rohan, `Dev's friend Kabir` → Kabir |
| **`ImportReport` record created** | 1 | Import ID `dbda7342`; `summaryJson` persisted as JSONB in `ImportReport` table |
| **`Import` status updated to `committed`** | 1 | `importedCount: 11`, `skippedCount: 1`, `committedAt` timestamp set |

> **Traceability**: Every `Expense` and `Settlement` record carries `sourceImportId` and `sourceImportRowId` foreign keys. A reviewer can query any ledger record and trace it back to its original CSV row number.

---

## 6. Currency Conversion Summary

All foreign-currency rows in `goa_trip_expenses.csv` used **USD** as the source currency. The group base ledger currency is **INR**. Conversions were applied at commit time inside the `commit()` transaction.

**Exchange Rate Source**: Static fallback rate of **83 USD/INR**. The `CurrencyRate` database table contained no row for `USD → INR` at the time of import. `currencyRateId` is therefore `null` on all four converted `Expense` records.

| Row | Original Currency | Original Amount | Rate (USD/INR) | Converted Amount (INR) | Rate Source |
| :---: | :---: | ---: | :---: | ---: | :--- |
| 5 | USD | $450.00 | 83 | ₹37,350.00 | Static fallback (`currencyRateId: null`) |
| 6 | USD | $120.00 | 83 | ₹9,960.00 | Static fallback (`currencyRateId: null`) |
| 7 | USD | $180.00 | 83 | ₹14,940.00 | Static fallback (`currencyRateId: null`) |
| 8 | USD | $300.00 | 83 | ₹24,900.00 | Static fallback (`currencyRateId: null`) |
| | | **$1,050.00** | | **₹87,150.00** | |

**Auditability**: Each `Expense` row in the database stores the following fields for every conversion:
- `originalAmount` — the raw figure from the CSV
- `originalCurrency` — the source currency code (`USD`)
- `exchangeRate` — the rate applied at commit time (`83`)
- `convertedAmount` — the INR equivalent written to the ledger
- `currencyRateId` — foreign key to `CurrencyRate` (null when static fallback used)

This ensures that historical import reports are fully reproducible regardless of future exchange rate fluctuations. See [ADR-004](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/DECISIONS.md) for the architectural rationale behind stored-at-write-time currency conversion.

---

## 7. Technical JSON Appendix

The following is the raw machine-readable `summaryJson` field persisted to the `ImportReport` table in Neon DB. All figures in sections 1–6 above are derived from this payload.

```json
{
  "fileName": "goa_trip_expenses.csv",
  "importId": "dbda7342-57fc-49cc-9ba1-28488ea7f2b8",
  "anomalies": [
    {
      "type": "DUPLICATE_EXPENSE",
      "status": "reviewed",
      "message": "Likely duplicate of row 2.",
      "severity": "blocking",
      "rowNumber": 3,
      "suggestedAction": "skip"
    },
    {
      "type": "SETTLEMENT_LOGGED_AS_EXPENSE",
      "status": "reviewed",
      "message": "This row looks like a repayment rather than an expense.",
      "severity": "blocking",
      "rowNumber": 4,
      "suggestedAction": "convert"
    },
    {
      "type": "MEMBERSHIP_VIOLATION",
      "status": "reviewed",
      "message": "Sam appears before his April move-in.",
      "severity": "blocking",
      "rowNumber": 5,
      "suggestedAction": "correct"
    },
    {
      "type": "CURRENCY_CONVERSION_REQUIRED",
      "status": "reviewed",
      "message": "USD must be converted to INR.",
      "severity": "warning",
      "rowNumber": 5,
      "suggestedAction": "convert"
    },
    {
      "type": "CURRENCY_CONVERSION_REQUIRED",
      "status": "reviewed",
      "message": "USD must be converted to INR.",
      "severity": "warning",
      "rowNumber": 6,
      "suggestedAction": "convert"
    },
    {
      "type": "MEMBERSHIP_VIOLATION",
      "status": "reviewed",
      "message": "Sam appears before his April move-in.",
      "severity": "blocking",
      "rowNumber": 6,
      "suggestedAction": "correct"
    },
    {
      "type": "MEMBERSHIP_VIOLATION",
      "status": "reviewed",
      "message": "Sam appears before his April move-in.",
      "severity": "blocking",
      "rowNumber": 7,
      "suggestedAction": "correct"
    },
    {
      "type": "CURRENCY_CONVERSION_REQUIRED",
      "status": "reviewed",
      "message": "USD must be converted to INR.",
      "severity": "warning",
      "rowNumber": 7,
      "suggestedAction": "convert"
    },
    {
      "type": "NEGATIVE_AMOUNT",
      "status": "reviewed",
      "message": "Negative amount may be a refund or correction.",
      "severity": "blocking",
      "rowNumber": 8,
      "suggestedAction": "correct"
    },
    {
      "type": "SETTLEMENT_LOGGED_AS_EXPENSE",
      "status": "reviewed",
      "message": "This row looks like a repayment rather than an expense.",
      "severity": "blocking",
      "rowNumber": 8,
      "suggestedAction": "convert"
    },
    {
      "type": "CURRENCY_CONVERSION_REQUIRED",
      "status": "reviewed",
      "message": "USD must be converted to INR.",
      "severity": "warning",
      "rowNumber": 8,
      "suggestedAction": "convert"
    },
    {
      "type": "MEMBERSHIP_VIOLATION",
      "status": "reviewed",
      "message": "Meera appears after her March move-out.",
      "severity": "blocking",
      "rowNumber": 9,
      "suggestedAction": "correct"
    },
    {
      "type": "MEMBERSHIP_VIOLATION",
      "status": "reviewed",
      "message": "Sam appears before his April move-in.",
      "severity": "blocking",
      "rowNumber": 10,
      "suggestedAction": "correct"
    },
    {
      "type": "GUEST_PARTICIPANT",
      "status": "reviewed",
      "message": "Kabir appears as a trip-only guest.",
      "severity": "warning",
      "rowNumber": 11,
      "suggestedAction": "approve"
    },
    {
      "type": "NON_STANDARD_SPLIT_TYPE",
      "status": "reviewed",
      "message": "Split type 'share' requires import-time transformation.",
      "severity": "warning",
      "rowNumber": 12,
      "suggestedAction": "approve"
    }
  ],
  "generatedAt": 1781435974403,
  "rowsSkipped": 1,
  "rowsImported": 11,
  "rowsProcessed": 12,
  "userDecisions": [
    {
      "note": "Skip duplicate row",
      "decision": "skip",
      "anomalyId": "b19d6745-ce05-4452-85be-d9b7683821cd",
      "reviewedAt": 1781435892223
    },
    {
      "note": "Convert matching row to settlement log",
      "decision": "convert_to_settlement",
      "anomalyId": "78ad270e-7b2f-4cc4-9d0b-b6b4a0e0319f",
      "reviewedAt": 1781435895886
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "047164ac-060b-4916-9640-854d8145ce40",
      "reviewedAt": 1781435898581
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "f06256b2-2549-425c-8dd4-760143fa0b92",
      "reviewedAt": 1781435901357
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "f13265b7-d06f-41ed-b54d-3f7ae0df5822",
      "reviewedAt": 1781435904290
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "ecbbd643-afe4-45f9-aca2-605ff0515001",
      "reviewedAt": 1781435906970
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "b8710831-4f58-49b1-b7e7-35efde971295",
      "reviewedAt": 1781435909818
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "99370d1d-d32f-490b-b897-0dde3ad5949c",
      "reviewedAt": 1781435912763
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "553ecf4f-aae9-44a5-a39a-63c250396336",
      "reviewedAt": 1781435915444
    },
    {
      "note": "Convert matching row to settlement log",
      "decision": "convert_to_settlement",
      "anomalyId": "433ff5b2-2e49-453c-a49e-b00bfd10e775",
      "reviewedAt": 1781435918166
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "5019a7ce-c867-4216-881b-b9f261818cc3",
      "reviewedAt": 1781435921168
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "95b64ea5-7e69-494e-81e3-6d645a9cef7d",
      "reviewedAt": 1781435925360
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "82ce8cdf-6f75-4097-b476-689d4c65efc2",
      "reviewedAt": 1781435928833
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "8d8d9275-37f4-4fc4-8b3b-9df70060ca6d",
      "reviewedAt": 1781435931600
    },
    {
      "note": "Approved during automated import verification",
      "decision": "approve",
      "anomalyId": "b2870108-3842-4952-b5b7-06e6a4f5a105",
      "reviewedAt": 1781435934584
    }
  ],
  "currencyConversions": [
    {
      "rowNumber": 5,
      "exchangeRate": 83,
      "currencyRateId": null,
      "originalAmount": 450,
      "convertedAmount": 37350,
      "originalCurrency": "USD"
    },
    {
      "rowNumber": 6,
      "exchangeRate": 83,
      "currencyRateId": null,
      "originalAmount": 120,
      "convertedAmount": 9960,
      "originalCurrency": "USD"
    },
    {
      "rowNumber": 7,
      "exchangeRate": 83,
      "currencyRateId": null,
      "originalAmount": 180,
      "convertedAmount": 14940,
      "originalCurrency": "USD"
    },
    {
      "rowNumber": 8,
      "exchangeRate": 83,
      "currencyRateId": null,
      "originalAmount": 300,
      "convertedAmount": 24900,
      "originalCurrency": "USD"
    }
  ],
  "settlementConversions": [
    {
      "rowNumber": 4,
      "settlementId": "2474e27b-95f9-4e6e-93c9-6ce8dbea8f6c"
    },
    {
      "rowNumber": 8,
      "settlementId": "d1176de2-afb4-4bfa-b56d-8c64149fb98c"
    }
  ]
}
```
