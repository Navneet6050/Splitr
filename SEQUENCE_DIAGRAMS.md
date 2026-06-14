# Sequence Flow Diagrams

This document details the step-by-step sequence flows for authentication, expense creations, debt settlements, CSV ingestion pipelines, anomaly reviews, and report generation in Splitr.

---

## 🔐 1. User Login & Session Sync

```mermaid
sequenceDiagram
    actor User as Group Member
    participant FE as Next.js Client
    participant Clerk as Clerk Gateway
    participant BE as Next.js Server Action
    participant DB as Neon DB

    User->>FE: Access page /dashboard
    FE->>Clerk: Validate active session token (JWT)
    Clerk-->>FE: Return verified JWT claims
    FE->>BE: Call `getCurrentUser()` with Bearer JWT
    BE->>BE: Check local DB cache for Clerk tokenIdentifier
    alt User not found in DB
        BE->>DB: Create User record with email, name, imageUrl
    else User exists
        BE->>DB: Retrieve User record
    end
    DB-->>BE: User Object
    BE-->>FE: Complete User Session Context
```

---

## 💸 2. Manual Expense Creation & Split Configuration

```mermaid
sequenceDiagram
    actor User as Group Member
    participant FE as Next.js Client
    participant BE as Next.js Server Action
    participant DB as Neon DB

    User->>FE: Fill description, amount, split shares
    FE->>BE: Call `createExpense({ description, amount, splitType, splits })`
    BE->>BE: Assert user is member of target group
    BE->>BE: Validate splits math (sum of percentages = 100%, exact = total)
    BE->>DB: Open ACID Transaction
    BE->>DB: Insert Expense record (JSON and meta)
    BE->>DB: Bulk Insert ExpenseSplits (normalized relational rows)
    BE->>DB: Close Transaction
    DB-->>BE: Commit Confirmation
    BE-->>FE: Return created Expense details
```

---

## 🧾 3. Repayment Settlement Logging

```mermaid
sequenceDiagram
    actor User as Debtor
    participant FE as Next.js Client
    participant BE as Next.js Server Action
    participant DB as Neon DB

    User->>FE: Input recipient, amount, note
    FE->>BE: Call `createSettlement({ receivedByUserId, amount, note })`
    BE->>BE: Assert both users belong to target group
    BE->>DB: Write Settlement record
    DB-->>BE: Success
    BE-->>FE: Return settlement receipt
```

---

## 📂 4. CSV Ingestion, Staging & Anomaly Flagging

```mermaid
sequenceDiagram
    actor User as Group Owner
    participant FE as Next.js Client
    participant BE as Next.js Server Action
    participant Det as In-Memory Detectors
    participant DB as Neon DB

    User->>FE: Drop CSV file
    FE->>BE: Call `upload({ fileText })`
    BE->>BE: Parse CSV rows into structured raw mappings
    BE->>Det: Run validation rules (dates, aliases, duplicates, memberships)
    Det-->>BE: Return anomalies list and validation scores
    BE->>DB: Open Transaction
    BE->>DB: Bulk insert Import and ImportRows
    BE->>DB: Bulk insert ImportAnomalies
    BE->>DB: Close Transaction
    DB-->>BE: Commit Success
    BE-->>FE: Return staged import details & anomalies grid
```

---

## 🔧 5. Anomaly Review & Corrections

```mermaid
sequenceDiagram
    actor User as Group Owner
    participant FE as Next.js Client
    participant BE as Next.js Server Action
    participant DB as Neon DB

    User->>FE: Select anomaly, insert correct value (e.g. valid Date)
    FE->>BE: Call `reviewAnomaly({ anomalyId, decision, correctedValue })`
    BE->>DB: Create/Update AnomalyReview record
    BE->>DB: Update ImportAnomaly status to "RESOLVED"
    BE->>DB: Update ImportRow parsed JSON with correctedValue
    DB-->>BE: Commit
    BE-->>FE: Return updated anomalies state
```

---

## 📊 6. Ledger Resolution & Commit Ingestion

```mermaid
sequenceDiagram
    actor User as Group Owner
    participant FE as Next.js Client
    participant BE as Next.js Server Action
    participant DB as Neon DB

    User->>FE: Click Commit Ingestion
    FE->>BE: Call `commitImport({ importId })`
    BE->>DB: Query unresolved blocking anomalies
    alt Blocking anomalies exist
        BE-->>FE: Block commit with exception
    else No blocking anomalies
        BE->>DB: Open Transaction
        BE->>DB: Retrieve all staged ImportRows
        BE->>DB: Bulk Insert Expenses & ExpenseSplits (marked as imported)
        BE->>DB: Bulk Insert Settlements (for converted refund rows)
        BE->>DB: Create ImportReport containing summary statistics
        BE->>DB: Set Import status to "COMMITTED"
        BE->>DB: Close Transaction
        DB-->>BE: Commit Success
        BE-->>FE: Return final ingestion report details
    end
```
