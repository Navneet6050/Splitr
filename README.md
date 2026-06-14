# Splitr: Relational Expense Sharing & Anomaly-Detection Engine

Splitr is a high-performance bill-splitting and financial ledger application built with **Next.js (App Router)**, **Prisma ORM**, and **PostgreSQL (Neon DB)**. The platform features dynamic multi-currency calculations, an advanced CSV import validation pipeline, serverless background jobs, and a unique **API Proxy Bridge** that facilitates server action dispatching.

---

## 🏗️ System Architecture

Splitr utilizes a decoupled serverless-ready architecture optimized for scale, consistency, and low latency:

```mermaid
graph TD
    Client[Next.js Client Components] -->|dot-notation call| Proxy[Client-Side API Proxy Bridge]
    Proxy -->|Dynamic Server Action Resolve| ServerActions[Next.js Server Actions / API Bridge]
    ServerActions -->|Authentication Verification| Clerk[Clerk Auth / Identity]
    ServerActions -->|Relational Queries| Prisma[Prisma ORM Client]
    Prisma -->|Transaction Execution| Postgres[Neon DB / PostgreSQL]
    Postgres -->|Async Trigger Events| Inngest[Inngest Serverless Queues]
    Inngest -->|Notifications & Reports| Resend[Resend Mail Service]
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
    actor User as User Agent
    participant SV as Client Import Page
    participant SA as Imports Server Action
    database DB as PostgreSQL (Neon)

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
