# Splitr: Relational Expense Sharing & Anomaly-Detection Engine

Splitr is a high-performance bill-splitting and financial ledger application built with **Next.js (App Router)**, **Prisma ORM**, and **PostgreSQL (Neon DB)**, developed in pair programming with **Antigravity AI (Google DeepMind)**. The platform features dynamic multi-currency calculations, an advanced CSV import validation pipeline, serverless background jobs, and a unique **API Proxy Bridge** that facilitates server action dispatching.

---

## 🏗️ System Architecture

Splitr utilizes a decoupled serverless-ready architecture optimized for scale, consistency, and low latency:

```mermaid
graph TD
    Client["Next.js Client Components"] -->|dot-notation call| Proxy["Client-Side API Proxy Bridge"]
    Proxy -->|Dynamic Server Action Resolve| ServerActions["Next.js Server Actions / API Bridge"]
    ServerActions -->|Authentication Verification| Clerk["Clerk Auth / Identity"]
    ServerActions -->|Relational Queries| Prisma["Prisma ORM Client"]
    Prisma -->|Transaction Execution| Postgres["Neon DB / PostgreSQL"]
    Postgres -->|Async Trigger Events| Inngest["Inngest Serverless Queues"]
    Inngest -->|Notifications & Reports| Resend["Resend Mail Service"]
```

### Key Architectural Layers

1. **Frontend (Next.js 15 App Router)**: Optimized client rendering, Server-Side Rendering (SSR) for static content, and standard CSS with custom design tokens.
2. **Dynamic API Proxy Bridge (`convex/_generated/api.js` & `hooks/use-convex-query.js`)**: An architectural adaptation pattern that intercepts client-side Convex references (e.g., `api.users.getCurrentUser`) via JavaScript `Proxy` objects and routes them dynamically to Next.js Server Actions (`lib/api-bridge.js`). This avoided rewrites across 20+ pages during the database migration.
3. **Database & ORM (PostgreSQL & Prisma)**: A fully normalized relational schema deployed on Neon DB, complete with foreign key constraints, index maps for rapid ledger lookups, and transaction boundaries.
4. **Background Orchestration (Inngest & Resend)**: Event-driven worker queues handling background operations like scheduled payment reminders and monthly AI-driven spending insights without blocking the main event loop.

---

## 🗄️ Relational Database Schema

The database model is designed for strict integrity, featuring cascading deletes for expenses/settlements, and transactional staging tables for CSV imports:

```mermaid
erDiagram
    User ||--o{ GroupMembership : has
    User ||--o{ Expense : pays
    User ||--o{ ExpenseSplit : owes
    User ||--o{ Settlement : pays_receives
    Group ||--|{ GroupMembership : contains
    Group ||--o{ Expense : records
    Group ||--o{ Settlement : tracks
    Import ||--|{ ImportRow : stages
    ImportRow ||--o{ ImportAnomaly : generates
    ImportRow ||--o{ AnomalyReview : receives
    Import ||--o{ Alias : defines
```

### Main Entities
* **`User`**: Core user profiles synchronized with Clerk JWT identity tokens.
* **`Group`**: Collaborative financial scopes creating ledger boundaries.
* **`GroupMembership`**: Historical, time-bound membership records. Tracks when users join or leave, allowing accurate temporal splits.
* **`Expense` & `ExpenseSplit`**: Normalized transaction details and split records (supporting equal, percentage, exact, and share split ratios).
* **`Settlement`**: Financial transfers tracking debt clearing logs.
* **`Import` / `ImportRow` / `ImportAnomaly`**: CSV staging tables allowing users to review and correct transaction anomalies before committing them to the main ledger.

---

## 🔄 Data Pipeline: CSV Import & Committing

One of Splitr's key engines is the `/import` workflow, designed to clean, normalize, and commit legacy spreadsheet records:

```mermaid
sequenceDiagram
    actor User as "User Agent"
    participant SV as "Client Import Page"
    participant SA as "Imports Server Action"
    participant DB as "PostgreSQL (Neon)"

    User->>SV: Upload CSV File
    SV->>SA: create({ groupId, csvText, fileName })
    SA->>DB: Start Transaction (30s Timeout)
    SA->>DB: Batch Insert Import & Staged Rows (createManyAndReturn)
    Note over SA,DB: Anomaly Detectors Analyze Staged Rows
    SA->>DB: Batch Insert Anomalies (createMany)
    SA->>DB: Update Import Status (needs_review / ready)
    SA->>DB: Commit Transaction
    SA->>SV: Return Import Staging Report
    User->>SV: Review / Apply Corrections (Skip, Convert, Edit)
    User->>SV: Click Approve & Commit
    SV->>SA: commit({ importId })
    SA->>DB: Start Transaction (60s Timeout)
    Note over SA,DB: Run Currency Conversion, Alias Resolutions & Membsh. Windows
    SA->>DB: Insert Cleaned Expenses, Splits & Settlements
    SA->>DB: Commit Transaction
    SA->>SV: Render Final JSON Commit Report
```

---

## ⚡ Design Patterns & Performance Optimizations

### 1. Interactive Transaction Batching
To bypass network latency over remote database connections (avoiding Prisma transaction expiration timeouts `P2028`), the staging pipeline is optimized using batch operations:
* Loops of single queries are consolidated using **`createManyAndReturn`** and **`createMany`**, reducing transaction overhead from hundreds of sequential HTTP calls down to a single PostgreSQL batch insertion command.
* Dynamic query timeout maps configure safe execution bounds (`30s` for staging, `60s` for complex commits).

### 2. Temporal Membership Windows
Group memberships track strict `joinedAt` and `leftAt` timestamps. During CSV imports, Splitr validates expense dates against active membership windows:
* If a participant (e.g. `Dev`) is recorded on an expense date outside their membership window, the anomaly engine flag a **`MEMBERSHIP_OUT_OF_BOUNDS`** alert, suggesting conversion to temporary membership or exclusion.

### 3. Pairwise Ledger Resolution
To render dashboard balances, Splitr executes a pairwise resolution algorithm:
1. Pulls all expenses and settlements for a group.
2. Accumulates raw owed/owes ratios per participant.
3. Computes net pairwise debts.
4. Generates an audit trail path mapping exactly who owes whom, reducing multiple circular debts into direct, optimized transfers.

---

## ⚙️ Environment Configuration

Ensure your `.env` file at the root contains the following variables:

```env
# Database Connections
DATABASE_URL="postgresql://user:password@neon-db-endpoint/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@neon-db-endpoint/dbname?sslmode=require"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CLERK_JWT_ISSUER_DOMAIN="https://clerk-issuer-domain"

# Services
RESEND_API_KEY=re_...
GEMINI_API_KEY=AIzaSy...
```

---

## 🚀 Getting Started

### 1. Install Workspace Dependencies
```bash
npm install
```

### 2. Run Prisma Database Migrations
Synchronize your Neon DB schema with the local schema definition:
```bash
npx prisma db push
```

### 3. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🧪 Verification & Linting

Verify syntax, typing, and standard ESM import compatibility across Next.js SSR boundaries:
```bash
npm run build
npm run lint
```

---

## ✅ Assignment Requirements Coverage Matrix

This table maps every explicit assignment requirement to the Splitr file(s) where it is implemented. Nothing in this table is inferred — each entry was verified against the live codebase.

| Requirement | Status | Key File(s) |
| :--- | :--- | :--- |
| Upload & stage a CSV expense file | ✅ Done | [import/page.jsx](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/app/(main)/import/page.jsx), [imports.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/actions/imports.js) |
| Anomaly detection before commit | ✅ Done | [lib/import/detectors/](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/) — 9 detector modules |
| User review & correction workflow | ✅ Done | Approve / Skip / Convert to Settlement in [import/page.jsx](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/app/(main)/import/page.jsx) |
| Commit approved rows to the ledger | ✅ Done | `commitImport()` in [imports.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/actions/imports.js) |
| Generate import report | ✅ Done | `generateReport()` in [imports.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/actions/imports.js); persisted to `ImportReport` table |
| Expense splitting — equal / % / exact | ✅ Done | [expenses.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/actions/expenses.js), `ExpenseSplit` in [schema.prisma](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/prisma/schema.prisma) |
| Settlement / repayment logging | ✅ Done | [settlements.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/actions/settlements.js) |
| USD → INR currency conversion | ✅ Done | [currency.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/actions/currency.js), `CurrencyRate` table |
| Temporal membership windows | ✅ Done | [memberships.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/actions/memberships.js), [membershipDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/membershipDetector.js) |
| Pairwise debt resolution / simplification | ✅ Done | [balances.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/actions/balances.js) |
| Name alias resolution | ✅ Done | [aliasDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/aliasDetector.js), `Alias` table |
| Setup instructions in README | ✅ Done | **Getting Started** section above |
| AI usage disclosure | ✅ Done | [AI_USAGE.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/AI_USAGE.md) |
| Anomaly log (`SCOPE.md`) | ✅ Done | [SCOPE.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/SCOPE.md) |
| Database schema (`SCOPE.md`) | ✅ Done | [SCOPE.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/SCOPE.md) + [DATABASE_DESIGN.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/DATABASE_DESIGN.md) |
| Decision log (`DECISIONS.md`) | ✅ Done | [DECISIONS.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/DECISIONS.md) — 6 ADRs with options, tradeoffs & revisit criteria |

---

## 🤖 AI Assistance Disclosure

Splitr was developed in pair programming with **Codex** and **Antigravity (Google DeepMind)**. The full disclosure of tools, prompts, and human corrections is in [AI_USAGE.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/AI_USAGE.md).

Three cases where AI output was wrong and manually corrected:

| # | AI Mistake | How It Was Caught | Fix Applied |
| :--- | :--- | :--- | :--- |
| 1 | `useConvexMutation` re-created its dispatcher on every render, triggering an infinite loop of duplicate `User` inserts | Browser froze; devserver logs flooded with `INSERT INTO User` | Wrapped dispatcher in `useCallback` in [use-convex-query.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/hooks/use-convex-query.js) |
| 2 | `useConvexQuery` forwarded the literal string `"skip"` as a query argument rather than short-circuiting, crashing the server with `PrismaClientValidationError` (`id: undefined`) | Runtime server crash on page load before any import existed | Added `args === "skip"` guard on line 23 of [use-convex-query.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/hooks/use-convex-query.js) |
| 3 | Sequential `await tx.importRow.create()` calls inside a Prisma interactive transaction expired (`P2028`) for any CSV with 12+ rows | `Transaction already closed` thrown mid-import | Rewrote staging to use `createManyAndReturn` + in-memory accumulation; reduced 170+ DB roundtrips to 3 |

---

## 🚩 Supported CSV Anomalies Summary

The engine in [lib/import/detectors/](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/) identifies the following problems automatically during staging. Full resolution policies are in [SCOPE.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/SCOPE.md).

| Anomaly | Severity | Detector | Reviewer Action in UI |
| :--- | :--- | :--- | :--- |
| `DUPLICATE_EXPENSE` | 🔴 Blocking | [duplicateDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/duplicateDetector.js) | Skip or Force Approve |
| `NEAR_DUPLICATE` | 🟡 Warning | [duplicateDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/duplicateDetector.js) | Confirm or Skip |
| `INVALID_DATE` | 🔴 Blocking | [dateFormatDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/dateFormatDetector.js) | Edit date in grid or Skip |
| `AMBIGUOUS_DATE` | 🔴 Blocking | [dateFormatDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/dateFormatDetector.js) | Confirm parsed date or edit |
| `MISSING_PAYER` | 🔴 Blocking | [participantDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/participantDetector.js) | Select member or Skip |
| `CURRENCY_CONVERSION_REQUIRED` | 🟡 Warning | [currencyDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/currencyDetector.js) | Auto-converted to INR; original values preserved |
| `NEGATIVE_AMOUNT` | 🔴 Blocking | [amountDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/amountDetector.js) | Convert to Settlement or Skip |
| `SETTLEMENT_LOGGED_AS_EXPENSE` | 🔴 Blocking | [participantDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/participantDetector.js) | Convert to Settlement |
| `NON_STANDARD_SPLIT_TYPE` | 🟡 Warning | [splitTypeDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/splitTypeDetector.js) | Auto-normalized to equal or weighted |
| `NAME_ALIAS` | 🟡 Warning | [aliasDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/aliasDetector.js) | Auto-resolved via `Alias` table |
| `MEMBERSHIP_VIOLATION` | 🔴 Blocking | [membershipDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/membershipDetector.js) | Adjust membership dates or Skip |

---

## 🗺️ Reviewer Walkthrough / Demo Flow

Follow these steps to evaluate the full import-to-ledger pipeline in under 10 minutes:

### Step 1 — Environment Setup (~3 min)
```bash
npm install
npx prisma db push    # sync schema to Neon DB
npm run dev           # open http://localhost:3000
```
Sign in via Clerk (Google OAuth or email). Your `User` record is created automatically on first login.

### Step 2 — Create a Group (~1 min)
* Navigate to **Contacts → Create Group**.
* Add member names that match the `paid_by` / `split_with` values in your CSV.

### Step 3 — Upload & Stage a CSV (~2 min)
* Navigate to **Import CSV** in the sidebar.
* Drop a CSV with required columns: `date`, `description`, `paid_by`, `amount`, `currency`, `split_type`, `split_with`, `split_details`, `notes`.
* The staging grid renders immediately. Anomalous rows are flagged with 🔴 blocking or 🟡 warning badges.

### Step 4 — Resolve Anomalies (~2 min)
* **Blocking rows** must be resolved before committing: click **Skip** to discard, or click the action badge to **Convert to Settlement** for repayment rows.
* **Warning rows** may be committed as-is.

### Step 5 — Commit & Review Report (~1 min)
* Click **Approve & Commit**.
* The engine creates `Expense`, `ExpenseSplit`, and `Settlement` records and generates an `ImportReport`.
* The on-screen report shows total ingested rows, skipped rows, anomalies resolved, and currency conversions applied.
* A static cached copy is at [IMPORT_REPORT.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/IMPORT_REPORT.md).

### Step 6 — Verify Balances
* Navigate to **Balances** to confirm the greedy pairwise ledger resolution — showing exactly who owes whom and the optimal payment paths.

---

## 📄 Deliverables Mapping

All required assignment deliverables are at the repository root:

| Required Deliverable | File |
| :--- | :--- |
| README with setup instructions and AI used | [README.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/README.md) |
| SCOPE.md — anomaly log + database schema | [SCOPE.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/SCOPE.md) |
| DECISIONS.md — decision log with options and rationale | [DECISIONS.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/DECISIONS.md) |
| Import report — anomalies detected and actions taken | [IMPORT_REPORT.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/IMPORT_REPORT.md) |
| AI_USAGE.md — tools, prompts, three AI correction cases | [AI_USAGE.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/AI_USAGE.md) |

Additional supporting documentation:

| Document | Purpose |
| :--- | :--- |
| [ARCHITECTURE.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/ARCHITECTURE.md) | System overview, design rules, data flows |
| [C4_MODEL.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/C4_MODEL.md) | C4 Levels 1–4 diagrams |
| [DATABASE_DESIGN.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/DATABASE_DESIGN.md) | ER diagram, index matrix, temporal integrity SQL |
| [SYSTEM_DESIGN.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/SYSTEM_DESIGN.md) | NFRs, capacity estimates, 5→1M scaling roadmap |
| [SEQUENCE_DIAGRAMS.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/SEQUENCE_DIAGRAMS.md) | Mermaid flows: auth, expense, settlement, import, commit |
| [SECURITY_REVIEW.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/SECURITY_REVIEW.md) | STRIDE threat model, IDOR mitigation, CSV safeguards |
| [TEST_STRATEGY.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/TEST_STRATEGY.md) | Split rounding specs, timezone handling, QA matrix |
| [PRODUCTION_READINESS.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/PRODUCTION_READINESS.md) | Readiness scorecard, error codes, backup/recovery |
| [OBSERVABILITY.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/OBSERVABILITY.md) | Log schema, KPI metrics, alert thresholds |
| [COST_ANALYSIS.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/COST_ANALYSIS.md) | Hosting cost models: 100 / 10K / 1M users |
| [INTERVIEW_DEFENSE.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/INTERVIEW_DEFENSE.md) | 50 senior-level architecture Q&A |
| [GAP_ANALYSIS.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/GAP_ANALYSIS.md) | Feature completeness matrix with risk levels |
| [REQUIREMENT_TRACEABILITY.md](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/REQUIREMENT_TRACEABILITY.md) | Requirement → UI → action → schema → logic mapping |
