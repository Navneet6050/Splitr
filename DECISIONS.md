# Decision Log

## Add Import Staging Instead of Direct Inserts

- Alternatives: insert directly into `expenses`, or stage rows first.
- Chosen: stage rows in `importRows`.
- Reason: the assignment requires anomalies to be surfaced and approved before canonical data changes.

## Preserve Existing Expense Shape

- Alternatives: fully migrate current expenses to normalized splits, or add normalized splits only for imports.
- Chosen: keep embedded `expenses.splits` and add `expenseSplits`.
- Reason: this protects existing UI while enabling assignment-grade drilldown and auditability.

## Store Currency Conversion on Each Expense

- Alternatives: convert dynamically at read time, or store import-time conversion.
- Chosen: store original amount, original currency, exchange rate, converted amount, and converted currency.
- Reason: balances must be reproducible after import even if rates change later.

## Use Membership Intervals

- Alternatives: use current group members only, or store historical intervals.
- Chosen: `memberships` with `joinedAt` and optional `leftAt`.
- Reason: Meera leaving, Sam joining, Dev visiting, and Kabir joining a trip are all time-dependent.

## Modular Anomaly Detectors

- Alternatives: one large validation block, or detector modules.
- Chosen: detector-style functions with consistent anomaly output.
- Reason: each detector can be explained, tested, and extended independently.

## User Approval Required for Blocking Anomalies

- Alternatives: auto-fix rows, skip rows automatically, or block until reviewed.
- Chosen: block approval until blocking anomalies are reviewed.
- Reason: silent mutation is explicitly a failing behavior in the assignment.

## PDF-Friendly Report Instead of Server PDF Rendering

- Alternatives: add a PDF dependency, use browser print/PDF, or JSON only.
- Chosen: persist JSON and render it in a PDF-friendly page.
- Reason: avoids deployment risk and keeps the audit source structured.
