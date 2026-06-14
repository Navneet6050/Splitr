# Splitr — Collaborative Expense Ledger with Intelligent CSV Ingestion

> A full-stack financial splitting platform with a multi-stage CSV import pipeline, anomaly detection engine, temporal membership enforcement, and pairwise debt resolution — built on Next.js 15, Prisma ORM, and PostgreSQL.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Database Schema](#database-schema)
- [CSV Import Pipeline](#csv-import-pipeline)
- [Anomaly Detection Engine](#anomaly-detection-engine)
- [Core Features](#core-features)
- [Environment Variables](#environment-variables)
- [Local Setup](#local-setup)
- [Reviewer Walkthrough](#reviewer-walkthrough)
- [Assignment Coverage Matrix](#assignment-coverage-matrix)
- [AI Assistance Disclosure](#ai-assistance-disclosure)
- [Documentation Index](#documentation-index)

---

## Overview

Splitr is a production-grade expense-sharing application that goes beyond simple bill splitting. Its central feature is a **CSV ingestion pipeline** that accepts raw spreadsheet exports, stages them into a review layer, runs nine independent anomaly detectors, and only commits clean, validated records to the ledger. Currency conversion, name alias resolution, and temporal membership enforcement are all handled automatically before a single row reaches the database.

The application resolves group balances using a **pairwise debt simplification algorithm** that collapses circular debts into the minimum set of direct transfers, and exposes this through a clean dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Standard CSS with custom design tokens |
| ORM & Database | Prisma ORM → Neon DB (PostgreSQL, serverless) |
| Authentication | Clerk (JWT, Google OAuth, email) |
| Background Jobs | Inngest (serverless queues) |
| Email | Resend |
| AI Integration | Gemini API (monthly spending insights) |

---

## System Architecture

Splitr uses an **API Proxy Bridge** pattern — a JavaScript `Proxy` object intercepts Convex-style client calls (e.g. `api.users.getCurrentUser`) and re-routes them dynamically to Next.js Server Actions. This adaptation layer preserved compatibility across 20+ pages during a mid-project database migration without requiring a full rewrite.

```mermaid
flowchart LR
    subgraph Browser
        A[React Client Components]
        B[API Proxy Bridge\nconvex/_generated/api.js]
    end

    subgraph Server["Next.js Server (App Router)"]
        C[Server Actions\nlib/api-bridge.js]
        D[Clerk Auth\nJWT Verification]
    end

    subgraph Data["Data & Services"]
        E[Prisma ORM]
        F[Neon DB\nPostgreSQL]
        G[Inngest\nJob Queues]
        H[Resend\nEmail]
    end

    A -->|dot-notation call| B
    B -->|dynamic resolution| C
    C -->|verify identity| D
    C -->|relational queries| E
    E -->|transactions| F
    F -->|async triggers| G
    G -->|notifications & reports| H
```

### Architectural Layers

**1. Frontend** — Next.js 15 App Router with SSR for static content and client rendering for interactive import grids.

**2. API Proxy Bridge** — `Proxy`-based adapter in `convex/_generated/api.js` and `hooks/use-convex-query.js` that maps Convex-style queries to Next.js Server Actions, eliminating a full page-by-page migration.

**3. Database Layer** — Fully normalized relational schema on Neon DB with foreign key constraints, cascading deletes, and indexed ledger lookups via Prisma.

**4. Background Orchestration** — Inngest queues handle scheduled payment reminders and AI-generated spending summaries without blocking request threads.

---

## Database Schema

The schema enforces strict referential integrity. Import staging uses dedicated tables (`Import`, `ImportRow`, `ImportAnomaly`) so raw CSV data is never written directly to the production ledger.

```mermaid
erDiagram
    User {
        string id PK
        string clerkId
        string name
        string email
    }
    Group {
        string id PK
        string name
        string currency
    }
    GroupMembership {
        string id PK
        datetime joinedAt
        datetime leftAt
    }
    Expense {
        string id PK
        decimal amount
        string currency
        string splitType
        datetime date
    }
    ExpenseSplit {
        string id PK
        decimal amountOwed
        string ratio
    }
    Settlement {
        string id PK
        decimal amount
        datetime settledAt
    }
    Import {
        string id PK
        string status
        string fileName
    }
    ImportRow {
        string id PK
        json rawData
        string status
    }
    ImportAnomaly {
        string id PK
        string type
        string severity
    }

    User ||--o{ GroupMembership : "belongs to"
    Group ||--|{ GroupMembership : "has"
    User ||--o{ Expense : "paid by"
    Group ||--o{ Expense : "contains"
    Expense ||--o{ ExpenseSplit : "split into"
    User ||--o{ ExpenseSplit : "owes"
    Group ||--o{ Settlement : "tracks"
    User ||--o{ Settlement : "party in"
    Import ||--|{ ImportRow : "stages"
    ImportRow ||--o{ ImportAnomaly : "triggers"
```

### Key Entities

- **`User`** — Profiles synced from Clerk JWT tokens on first login.
- **`Group`** — Financial scope that boundaries all expenses and settlements.
- **`GroupMembership`** — Time-bound membership with `joinedAt` / `leftAt` timestamps for temporal validation during imports.
- **`Expense` + `ExpenseSplit`** — Normalized transaction records supporting equal, percentage, exact-amount, and share-ratio splits.
- **`Settlement`** — Explicit debt-clearing records.
- **`Import` / `ImportRow` / `ImportAnomaly`** — CSV staging tables that isolate raw data for review before ledger commitment.

---

## CSV Import Pipeline

The import flow processes raw CSV files through a staged validation pipeline before writing anything to the main ledger.

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Import Page
    participant SA as Server Action
    participant DB as PostgreSQL

    U->>UI: Upload CSV file
    UI->>SA: createImport({ groupId, csvText, fileName })
    SA->>DB: Open transaction (30s timeout)
    SA->>DB: Batch insert Import + ImportRows (createManyAndReturn)
    Note over SA,DB: 9 anomaly detectors run in-memory
    SA->>DB: Batch insert ImportAnomalies (createMany)
    SA->>DB: Set import status → needs_review / ready
    SA->>DB: Commit transaction
    SA-->>UI: Return staging report
    U->>UI: Review rows — Skip / Convert / Edit
    U->>UI: Click "Approve & Commit"
    UI->>SA: commitImport({ importId })
    SA->>DB: Open transaction (60s timeout)
    Note over SA,DB: Currency conversion, alias resolution, membership checks
    SA->>DB: Insert Expenses, ExpenseSplits, Settlements
    SA->>DB: Commit transaction
    SA-->>UI: Render JSON commit report
```

### Performance: Batch Insertion

Early implementations used sequential `await tx.importRow.create()` calls inside a Prisma interactive transaction, which expired (`P2028`) for any CSV with more than 12 rows. The pipeline was rewritten to use `createManyAndReturn` + `createMany`, collapsing 170+ sequential database round-trips into three batch operations per import.

---

## Anomaly Detection Engine

Nine independent detector modules run against staged rows and classify issues as blocking (🔴) or advisory (🟡). Blocking anomalies must be resolved before the commit step is permitted.

| Anomaly Code | Severity | Detector Module | Resolution |
|---|---|---|---|
| `DUPLICATE_EXPENSE` | 🔴 Blocking | `duplicateDetector.js` | Skip or force approve |
| `NEAR_DUPLICATE` | 🟡 Warning | `duplicateDetector.js` | Confirm or skip |
| `INVALID_DATE` | 🔴 Blocking | `dateFormatDetector.js` | Edit inline or skip |
| `AMBIGUOUS_DATE` | 🔴 Blocking | `dateFormatDetector.js` | Confirm parsed date or edit |
| `MISSING_PAYER` | 🔴 Blocking | `participantDetector.js` | Select member or skip |
| `CURRENCY_CONVERSION_REQUIRED` | 🟡 Warning | `currencyDetector.js` | Auto-converted to INR; originals preserved |
| `NEGATIVE_AMOUNT` | 🔴 Blocking | `amountDetector.js` | Convert to settlement or skip |
| `SETTLEMENT_LOGGED_AS_EXPENSE` | 🔴 Blocking | `participantDetector.js` | Convert to settlement |
| `NON_STANDARD_SPLIT_TYPE` | 🟡 Warning | `splitTypeDetector.js` | Auto-normalized to equal or weighted |
| `NAME_ALIAS` | 🟡 Warning | `aliasDetector.js` | Auto-resolved via `Alias` table |
| `MEMBERSHIP_VIOLATION` | 🔴 Blocking | `membershipDetector.js` | Adjust membership window or skip |

---

## Core Features

### Expense Splitting
- **Four split modes**: equal, percentage, exact amount, and weighted share ratio.
- All splits are stored in normalized `ExpenseSplit` records, not as JSON blobs.

### Temporal Membership Windows
Group memberships carry `joinedAt` / `leftAt` timestamps. During import, any expense dated outside a participant's active membership window triggers a `MEMBERSHIP_VIOLATION` anomaly with options to extend the membership window or exclude the participant.

### Pairwise Debt Resolution
The balance engine:
1. Aggregates all expenses and settlements for a group.
2. Computes net owed/owes ratios per participant pair.
3. Applies a greedy simplification algorithm to reduce circular debts into the minimum number of direct transfers.
4. Produces a human-readable audit trail of who owes whom.

### Name Alias Resolution
The `Alias` table maps alternate spellings (e.g. `"Dev"` → `"Devraj Mehta"`) to canonical member records. Aliases are applied automatically during the commit phase.

### Multi-Currency Support
The `CurrencyRate` table stores conversion rates. Rows with non-INR amounts are automatically converted during commit; original currency values are retained for reference.

### Background Jobs
Inngest queues power two async workflows without blocking request threads:
- **Payment reminders**: scheduled nudges to unsettled members.
- **Monthly AI insights**: Gemini-generated spending summaries delivered via Resend.

---

## Environment Variables

Create a `.env` file at the repository root:

```env
# Database
DATABASE_URL="postgresql://user:password@neon-db-endpoint/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@neon-db-endpoint/dbname?sslmode=require"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CLERK_JWT_ISSUER_DOMAIN="https://clerk-issuer-domain"

# External Services
RESEND_API_KEY=re_...
GEMINI_API_KEY=AIzaSy...
```

---

## Local Setup

**Prerequisites**: Node.js 18+, a Neon DB project, and Clerk application credentials.

### 1. Install dependencies

```bash
npm install
```

### 2. Push the schema to Neon DB

```bash
npx prisma db push
```

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Signing in via Clerk automatically creates your `User` record.

### 4. Build and lint checks

```bash
npm run build
npm run lint
```

---

## Reviewer Walkthrough

End-to-end demonstration of the full import pipeline in under 10 minutes:

**Step 1 — Environment** (~3 min): Complete the [Local Setup](#local-setup) steps and sign in.

**Step 2 — Create a Group** (~1 min): Go to **Contacts → Create Group** and add members whose names match the `paid_by` / `split_with` values in your CSV.

**Step 3 — Upload a CSV** (~2 min): Navigate to **Import CSV** in the sidebar. Drop a file with these required columns:

```
date, description, paid_by, amount, currency, split_type, split_with, split_details, notes
```

The staging grid renders immediately. Rows with detected anomalies are flagged with 🔴 or 🟡 badges.

**Step 4 — Resolve Anomalies** (~2 min): Blocking rows must be actioned before commit. Use **Skip** to discard a row, or click the anomaly badge to access conversion actions (e.g. *Convert to Settlement*). Warning rows can be committed as-is.

**Step 5 — Commit** (~1 min): Click **Approve & Commit**. The engine writes `Expense`, `ExpenseSplit`, and `Settlement` records, generates an `ImportReport`, and renders a summary showing rows ingested, skipped, anomalies resolved, and currencies converted.

**Step 6 — Verify Balances**: Navigate to **Balances** to see the pairwise ledger — direct, simplified debt paths with no circular transfers.

---

## Assignment Coverage Matrix

Every requirement mapped to the implementing file(s), verified against the live codebase:

| Requirement | Status | Implementation |
|---|---|---|
| Upload & stage a CSV expense file | ✅ | `app/(main)/import/page.jsx`, `lib/actions/imports.js` |
| Anomaly detection before commit | ✅ | `lib/import/detectors/` — 9 detector modules |
| User review & correction workflow | ✅ | Approve / Skip / Convert in `import/page.jsx` |
| Commit approved rows to the ledger | ✅ | `commitImport()` in `lib/actions/imports.js` |
| Generate import report | ✅ | `generateReport()` in `imports.js`; persisted to `ImportReport` |
| Expense splitting — equal / % / exact | ✅ | `lib/actions/expenses.js`, `ExpenseSplit` in `schema.prisma` |
| Settlement / repayment logging | ✅ | `lib/actions/settlements.js` |
| USD → INR currency conversion | ✅ | `lib/actions/currency.js`, `CurrencyRate` table |
| Temporal membership windows | ✅ | `lib/actions/memberships.js`, `membershipDetector.js` |
| Pairwise debt resolution | ✅ | `lib/actions/balances.js` |
| Name alias resolution | ✅ | `aliasDetector.js`, `Alias` table |
| Setup instructions | ✅ | **Local Setup** section above |
| AI usage disclosure | ✅ | `AI_USAGE.md` |
| Anomaly log | ✅ | `SCOPE.md` |
| Database schema | ✅ | `SCOPE.md`, `DATABASE_DESIGN.md` |
| Decision log | ✅ | `DECISIONS.md` — 6 ADRs with options, tradeoffs, and revisit criteria |

---

## AI Assistance Disclosure

Splitr was developed with assistance from **Codex** and **Antigravity (Google DeepMind)**. Full tool disclosure, prompts used, and human corrections are documented in [`AI_USAGE.md`](./AI_USAGE.md).

Three cases where AI output required manual correction:

| # | What the AI Got Wrong | How It Was Caught | Fix |
|---|---|---|---|
| 1 | `useConvexMutation` re-created its dispatcher on every render, causing an infinite loop of duplicate `User` inserts | Browser froze; dev server flooded with `INSERT INTO User` logs | Wrapped dispatcher in `useCallback` in `hooks/use-convex-query.js` |
| 2 | `useConvexQuery` forwarded the literal string `"skip"` as a query argument instead of short-circuiting, crashing the server with `PrismaClientValidationError` (`id: undefined`) | Runtime server crash on page load before any import existed | Added `args === "skip"` guard at line 23 of `use-convex-query.js` |
| 3 | Sequential `await tx.importRow.create()` calls inside a Prisma transaction expired (`P2028`) for CSVs with 12+ rows | `Transaction already closed` error mid-import | Rewrote staging to use `createManyAndReturn` + in-memory accumulation, reducing 170+ DB round-trips to 3 |

---

## Documentation Index

### Required Deliverables

| File | Contents |
|---|---|
| [`README.md`](./README.md) | Setup instructions, architecture, AI disclosure |
| [`SCOPE.md`](./SCOPE.md) | Anomaly log + database schema |
| [`DECISIONS.md`](./DECISIONS.md) | 6 ADRs with options, tradeoffs, and revisit criteria |
| [`IMPORT_REPORT.md`](./IMPORT_REPORT.md) | Static export of a sample import run |
| [`AI_USAGE.md`](./AI_USAGE.md) | Tools, prompts, and three AI correction cases |

### Supplementary Documentation

| File | Purpose |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System overview, design principles, data flows |
| [`C4_MODEL.md`](./C4_MODEL.md) | C4 Levels 1–4 diagrams |
| [`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md) | ER diagram, index matrix, temporal integrity SQL |
| [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) | NFRs, capacity estimates, 5→1M user scaling roadmap |
| [`SEQUENCE_DIAGRAMS.md`](./SEQUENCE_DIAGRAMS.md) | Mermaid flows for auth, expense, settlement, import, and commit |
| [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) | STRIDE threat model, IDOR mitigation, CSV injection safeguards |
| [`TEST_STRATEGY.md`](./TEST_STRATEGY.md) | Split rounding specs, timezone handling, QA matrix |
| [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) | Readiness scorecard, error codes, backup and recovery plan |
| [`OBSERVABILITY.md`](./OBSERVABILITY.md) | Log schema, KPI metrics, alert thresholds |
| [`COST_ANALYSIS.md`](./COST_ANALYSIS.md) | Hosting cost models at 100 / 10K / 1M users |
| [`INTERVIEW_DEFENSE.md`](./INTERVIEW_DEFENSE.md) | 50 senior-level architecture Q&A |
| [`GAP_ANALYSIS.md`](./GAP_ANALYSIS.md) | Feature completeness matrix with risk classifications |
| [`REQUIREMENT_TRACEABILITY.md`](./REQUIREMENT_TRACEABILITY.md) | Requirement → UI → action → schema → logic mapping |
