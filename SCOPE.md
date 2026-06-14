# System Scope, Anomaly Specifications & Data Schema

This document defines the functional boundaries, business objectives, actor permissions, data anomalies, and database models of the Splitr application.

---

## 🎯 Part 1: Business Context & Domain Concepts

Splitr is a multi-currency expense management and debt optimization engine designed for group travel, shared households, and corporate trips. The primary business goals are to clean dirty CSV expense files, identify billing anomalies, convert cross-border currency exchanges back to a base currency (INR), and net balances to resolve peer-to-peer debts using the minimum possible payments.

### Key Domain Concepts
* **Group**: A collaborative container containing multiple members sharing expenses over a specific period.
* **Member**: A registered user associated with a Group during a specific time interval.
* **Temporal Membership**: High-integrity interval bounds (`joinedAt` to `leftAt`) tracking exactly when a participant is active in a Group. Splits are only valid within these intervals.
* **Expense**: A financial transaction representing an outlay by a single payer on behalf of one or more group members.
* **Expense Split**: The calculated percentage, ratio, or absolute share of an expense allocated to a specific debtor.
* **Settlement**: A cash/bank payment record moving from a debtor to a creditor to clear outstanding balances.
* **Anomaly**: A data structure or logical discrepancy in an imported CSV record (e.g. date formatting mismatch, name misspelling, membership violation).

---

## 👥 Part 2: User Scopes & Access Control

The system supports the following authorization scopes:

### 1. Group Creator (Owner)
* **Creation Rights**: Can create groups, configure base group currencies, and define the temporal boundaries of the group.
* **Administration Rights**: Can add or remove members, define custom participant alias mappings, upload CSV data, resolve and approve staged anomalies, and finalize/commit imports.
* **Data Mutability**: Can edit or delete any expense or settlement within their owned groups.

### 2. Group Member
* **Read-Only Context**: Accesses the dashboard, balances, and reports for groups they belong to.
* **Expense Reporting**: Can log manual expenses or settlements.
* **Import Operations**: Can view pending imports and anomaly logs but cannot approve or commit CSV imports to the ledger.

### 3. System Administrator (Future Evolution)
* **Platform Scope**: View global system logs, audit trails, and manage billing rates.
* **System-Wide Mappings**: Update seed exchange rates or run systemic database cleanup scripts.

---

## 🛠️ Part 3: Complete Anomaly Catalog & Handling Rules

Splitr uses a rules-based engine to scan staged CSV records. Below is the complete catalog of anomalies:

### 1. `DUPLICATE_EXPENSE` (Blocking)
* **Trigger Condition**: Identical date, amount, description, and participants in multiple rows.
* **Resolution**: User selects **Skip** (deletes the row) or **Commit** (bypasses check to keep it).

### 2. `NEAR_DUPLICATE` (Warning)
* **Trigger Condition**: Identical description and amount but dates differ by less than 24 hours.
* **Resolution**: Flagged for confirmation. Proceeding commits the row.

### 3. `INVALID_DATE` (Blocking)
* **Trigger Condition**: Unparsable date string (e.g., text, out-of-range months).
* **Resolution**: Row must be manually edited in the UI review table or skipped.

### 4. `AMBIGUOUS_DATE` (Blocking)
* **Trigger Condition**: String format like `05/06/2026` (could be May 6 or June 5).
* **Resolution**: The system defaults to standard `dd/mm/yyyy` but blocks commit until the user confirms the parsed date.

### 5. `MIXED_DATE_FORMAT` (Warning)
* **Trigger Condition**: The CSV file mixes multiple delimiters (`-`, `/`) or formats.
* **Resolution**: Parsed using best-effort heuristics; user receives a warning flag.

### 6. `MISSING_PAYER` (Blocking)
* **Trigger Condition**: `paid_by` column is empty.
* **Resolution**: User must select or write a valid member name in the UI, or skip.

### 7. `MISSING_CURRENCY` (Blocking)
* **Trigger Condition**: `currency` column is blank.
* **Resolution**: The engine defaults the row to base currency (INR) and generates an audit log.

### 8. `CURRENCY_CONVERSION_REQUIRED` (Warning)
* **Trigger Condition**: `currency` value is not the group base currency (INR).
* **Resolution**: Converts to INR using historical rates from `CurrencyRate`. Preserves original values for audit.

### 9. `NEGATIVE_AMOUNT` (Blocking)
* **Trigger Condition**: `amount` is negative (representing a refund).
* **Resolution**: Blocked unless the user converts it into a settlement or skips the row.

### 10. `ZERO_AMOUNT` (Warning)
* **Trigger Condition**: `amount` evaluates to 0.00.
* **Resolution**: Generates warning; user must confirm or skip.

### 11. `SETTLEMENT_LOGGED_AS_EXPENSE` (Blocking)
* **Trigger Condition**: Expense description matches patterns like "paid back", "refunded", or "settled".
* **Resolution**: User converts the row to a `Settlement` record in the UI, which bypasses split math.

### 12. `NON_STANDARD_SPLIT_TYPE` (Warning)
* **Trigger Condition**: Split columns contain unknown formats or keywords.
* **Resolution**: Normalizes split to "equal" or weights.

### 13. `NAME_ALIAS` (Warning)
* **Trigger Condition**: Participant name (e.g. `Rohan S`) matches an alias linked to a canonical user (`Rohan`).
* **Resolution**: Autolinks the transaction to the canonical user and records the confidence score.

### 14. `MEMBERSHIP_VIOLATION` (Blocking)
* **Trigger Condition**: Expense date is before `joinedAt` or after `leftAt` for a split participant.
* **Resolution**: Blocked until membership boundaries are modified or the user skips the row.

### 15. `GUEST_PARTICIPANT` (Warning)
* **Trigger Condition**: Participant listed in splits is not a member of the group.
* **Resolution**: Generates a guest account and auto-adds them to the group memberships database table.

---

## 🗄️ Part 4: Relational Database Schema

Refer to [schema.prisma](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/prisma/schema.prisma) for the exact database layout. The core models include:
- `User` - Synced with Clerk JWTs.
- `Group` - Container for expenses and memberships.
- `Expense` - Outlay records.
- `ExpenseSplit` - Relational records mapping who owes what.
- `Settlement` - Financial repayment receipts.
- `GroupMembership` - Tracks active member intervals.
- `Import`, `ImportRow`, `ImportAnomaly`, `AnomalyReview` - Ingestion engine pipelines.
- `Alias` - Resolves fuzzy participant names.
- `CurrencyRate` - Exchange rate oracle.
- `ImportReport` - Review summaries.
