# CSV Import Report: goa_trip_expenses.csv

Persisted in Neon DB under Import ID: `dbda7342-57fc-49cc-9ba1-28488ea7f2b8`
Group: **Goa Trip Importer Group**
Generated At: 2026-06-14T11:19:34.634Z

## Summary Statistics
* **Total Rows Staged**: undefined
* **Imported Rows**: undefined
* **Skipped Rows**: undefined
* **Anomalies Found**: undefined

## Import Details
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
