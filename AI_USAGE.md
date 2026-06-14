# AI_USAGE.md — Tools, Prompts & Correction Log

A complete record of the AI tools, key prompts, and hands-on corrections made during the development of Splitr. Each correction case documents what the AI produced, how the problem was discovered, and exactly how it was fixed.

---

## Table of Contents

- [1. Tools Used](#1-tools-used)
- [2. Key Prompts](#2-key-prompts)
- [3. Correction Cases](#3-correction-cases)
  - [Case 1: Infinite Re-Render Loop in User Sync Hook](#case-1-infinite-re-render-loop-in-user-sync-hook)
  - [Case 2: Prisma Crash from Unguarded "skip" Argument](#case-2-prisma-crash-from-unguarded-skip-argument)
  - [Case 3: Transaction Expiration on Bulk CSV Staging](#case-3-transaction-expiration-on-bulk-csv-staging)
  - [Case 4: AI Proposed Direct Insertion Instead of Staged Pipeline](#case-4-ai-proposed-direct-insertion-instead-of-staged-pipeline)
- [4. Architecture Planning Prompt](#4-architecture-planning-prompt)
- [5. Verification Process](#5-verification-process)

---

## 1. Tools Used

### AI Assistants

**Antigravity (Google DeepMind)** — Primary development partner throughout the project. Used for architecture design, relational schema planning, server action implementation, CSV import pipeline design, anomaly detector authoring, and build verification.

**Codex** — Supplementary tool for inline code completion and localized refactoring suggestions during implementation.

### Development & Verification Tools

**`npx tsx` CLI** — Compiled and ran ES-module scripts directly against the Neon DB connection to validate transaction pipelines and schema behaviour outside the Next.js runtime.

**Prisma CLI** (`npx prisma db push`, `npx prisma studio`) — Applied schema changes to the Neon PostgreSQL instance and provided a visual table inspector for confirming committed records during development.

**Next.js Dev Server** (`npm run dev`) — Hot-reload environment with server-side console output used to catch runtime crashes, transaction failures, and React hook regressions as they occurred.

**Neon DB Console** — Used to inspect raw table contents, verify `ImportReport` JSONB payloads, and confirm `GroupMembership` temporal records after CSV commit sessions.

---

## 2. Key Prompts

The following prompts represent the major interactions that drove significant architecture or implementation output:

> *"Analyze the existing Convex schema and redesign the application using PostgreSQL (Neon) and Prisma ORM. Create a normalized relational schema supporting users, groups, memberships, expenses, expense splits, settlements, imports, anomaly reviews, currency conversions, and audit trails. Explain the tradeoffs and migration strategy."*

> *"Design a production-grade CSV import pipeline that stages imported rows before committing them. Detect duplicates, currency issues, member lifecycle violations, aliases, malformed dates, settlement rows, and unsupported split types. Provide an approval workflow and audit trail."*

> *"Analyze why Prisma transactions are failing during bulk import execution. Investigate transaction lifecycle issues, nested writes, and long-running operations. Recommend a safe transactional strategy for staging, anomaly processing, and final record creation."*

> *"Invalid tx.importRow.create() invocation: Transaction API error: Transaction already closed."*

> *"Investigate Prisma query validation failures involving ImportWhereUniqueInput, relation mappings, and record lookups. Explain the root cause and propose schema or query corrections while preserving referential integrity."*

---

## 3. Correction Cases

### Case 1: Infinite Re-Render Loop in User Sync Hook

**What the AI produced**

The AI implemented an authentication sync hook in `hooks/use-store-user.jsx` that called a `storeUser` Server Action on layout mount. To support this, it also generated a `useConvexMutation` hook — but this hook instantiated a new `mutate` dispatcher function on every render cycle rather than stabilizing the reference across renders.

**How the problem was caught**

Within seconds of loading the application in the browser, the Next.js dev server console began flooding with repeated `SELECT` and `INSERT INTO User` SQL statements. The browser tab froze from stack recursion as the layout re-rendered, re-triggered the hook, fired the mutation, and updated state — in an infinite loop.

**How it was fixed**

The `mutate` dispatcher inside `useConvexMutation` was wrapped in `useCallback` with the query name as a memoized dependency. This stabilized the function reference across renders and broke the re-render cycle. The fix was applied in `hooks/use-convex-query.js`.

---

### Case 2: Prisma Crash from Unguarded `"skip"` Argument

**What the AI produced**

Pages that depended on an active import session used the Convex pattern of passing `"skip"` as the query arguments when no import was available:

```js
useQuery(api.imports.get, activeImportId ? { importId: activeImportId } : "skip")
```

The AI's `useConvexQuery` hook correctly checked `queryRef === "skip"` to short-circuit the query reference, but did not check whether the `args` parameter itself was `"skip"`. When `activeImportId` was falsy, the hook forwarded the literal string `"skip"` as the argument payload to the underlying Server Action.

**How the problem was caught**

On page load — before any import had been created — the server threw a `PrismaClientValidationError` in the `get` action in `lib/actions/imports.js`:

```
Argument `id`: Invalid value provided. Expected String, provided Undefined.
```

The query was attempting `findUnique({ where: { id: undefined } })` because `"skip"` was being destructured as an argument object.

**How it was fixed**

A single guard was added at line 23 of `hooks/use-convex-query.js`:

```js
if (queryRef === "skip" || args === "skip")
```

This short-circuits before the Server Action is called, sets `data` to `undefined`, and prevents the invalid request from reaching Prisma.

---

### Case 3: Transaction Expiration on Bulk CSV Staging

**What the AI produced**

The CSV staging and commit functions in `lib/actions/imports.js` used sequential `await` calls inside Prisma interactive transactions:

```js
for (const row of rows) {
  await tx.importRow.create({ data: { ...row } });
  await tx.group.update({ ... });
  await tx.expenseSplit.create({ ... });
}
```

Each iteration issued multiple database round-trips over the WAN connection to Neon DB.

**How the problem was caught**

Importing any CSV with 12 or more rows threw the following error mid-transaction:

```
Transaction already closed: A query cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 6580 ms passed since the start...
```

The default Prisma interactive transaction timeout of 5,000 ms was insufficient for the cumulative latency of 170+ sequential WAN round-trips.

**How it was fixed**

Three changes were made:

1. The sequential row-creation loop was replaced with a single `importRow.createManyAndReturn` call, staging all rows in one batch query.
2. Membership lookups, `GroupMembership` updates, and `ExpenseSplit` records were accumulated in memory during the loop and written to the database at the end of the transaction via a single `createMany` call.
3. Explicit transaction timeout overrides were added (`timeout: 30000` for staging, `timeout: 60000` for the commit phase) to maintain stable connection pool allocation.

Together these changes reduced the number of database round-trips from 170+ to 3, cutting transaction time from 30+ seconds to under 0.5 seconds.

---

### Case 4: AI Proposed Direct Insertion Instead of Staged Pipeline

**What the AI produced**

The initial AI proposal for the CSV import feature inserted rows directly into the `Expense` table inside a single transaction, with inline row-level validation using `try/catch` and per-row rollback on failure. No staging table existed. There was no anomaly review step, no approval workflow, and no import report.

**Why this was not acceptable**

The assignment explicitly required: (a) anomaly detection and logging before any record is committed, (b) a human review workflow where a reviewer resolves each flagged row, and (c) a generated import report documenting every detected issue and the action taken. The direct-insertion approach would have silently discarded problematic rows with no log, no reviewer interaction, and no report — failing the audit-trail requirement entirely.

**How the problem was caught**

Reviewing the assignment specification against the AI's proposed code showed that no `ImportAnomaly`, `AnomalyReview`, or `ImportReport` table was being populated. The proposed UI had no review grid. The `commit()` function had no status gate.

**How it was fixed**

The entire import architecture was redesigned:

1. Five new Prisma models were defined: `Import`, `ImportRow`, `ImportAnomaly`, `AnomalyReview`, and `ImportReport`.
2. The single-pass insertion was replaced with a two-phase pipeline:
   - `upload()` stages all rows in `ImportRow` and runs the anomaly detector in memory.
   - `approve()` blocks commit if any `ImportAnomaly` with `severity: "blocking"` has `status: "open"`.
   - `commit()` writes to `Expense` and `Settlement` only after all blocking anomalies have been reviewed.
3. Nine modular detector files were added under `lib/import/detectors/` — one per anomaly domain — each returning structured `{ type, severity, message, suggestedAction, confidenceScore }` objects that are bulk-inserted into `ImportAnomaly`.
4. The `commit()` function assembles a `summaryJson` object and persists it to `ImportReport` at the end of the transaction, satisfying the generated-report deliverable requirement.

---

## 4. Architecture Planning Prompt

Before any implementation began, the following prompt was used to produce a structured design document. This was intentional: generating architecture before code prevented the Case 4 error from reaching the implementation phase.

> *"You are a Principal Software Architect designing a production-grade expense-splitting and financial ledger application called Splitr. The app must support: multi-user group expense tracking with multiple split modes (equal, percentage, exact, shares); multi-currency support with conversion to a base currency at write time; a CSV import pipeline that stages rows before committing them, detects anomalies (duplicates, membership violations, repayment rows, foreign currencies, name aliases, malformed dates, non-standard split types), and provides a human-approval workflow before any data reaches the ledger; temporal group membership windows that track when each member was active; a greedy pairwise balance simplification algorithm; and a persisted audit report for every import session.*
>
> *Design the following:*
> *1. High-Level Design (HLD): System components, data flow, service boundaries, and external dependencies.*
> *2. Low-Level Design (LLD): Database schema with all models, fields, indexes, and foreign key constraints. Anomaly detector architecture. Transaction boundaries and timeout strategy.*
> *3. Import Pipeline Design: How CSV rows move from upload → staging → detection → review → approval → transformation → commit → report generation.*
> *4. Scalability Planning: How this design scales from 5 users to 10,000 users. What breaks first and how to fix it.*
> *5. Decision Log: For each major design decision, document the options considered, the chosen option, the tradeoffs, and the revisit criteria.*
>
> *Do not generate code yet. Output a structured architecture document first."*

This prompt produced the initial drafts of `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, and `DECISIONS.md` before a single line of application code was written. Having those documents in place meant the staged import pipeline was a design requirement from day one rather than a retrofit.

---

## 5. Verification Process

Every significant piece of AI-generated code went through the following five-step process before being considered complete.

### Step 1 — Build Verification

`npm run build` was run after every significant change to catch Next.js compilation errors, SSR import boundary violations, and TypeScript type mismatches surfaced by the ESLint configuration. ESM import compatibility between server action files and client components was confirmed by verifying zero `SyntaxError` or `ReferenceError` outputs in the build output.

### Step 2 — Schema Review Against Prisma

Every model addition and field change was reviewed in `prisma/schema.prisma` before running `npx prisma db push` against the Neon instance. Field types, nullable constraints, cascade delete rules, and unique index definitions were manually checked against the intended data model. `npx prisma studio` was used after each push to confirm that tables were created with the correct columns and that foreign key references resolved without errors.

### Step 3 — Transaction Pipeline Testing

The `npx tsx` CLI was used to run standalone scripts directly against the Neon DB connection, validating `createManyAndReturn` batch inserts, anomaly bulk-insertion via `createMany`, and the commit transaction's in-memory membership accumulator — independent of the Next.js runtime. These scripts confirmed that the 30-second staging timeout and 60-second commit timeout were sufficient for the 12-row `goa_trip_expenses.csv` dataset and verified that the round-trip reduction from 170+ individual queries to 3 batched operations was functioning as expected.

### Step 4 — End-to-End Browser Testing

Every import pipeline stage was exercised against the `goa_trip_expenses.csv` dataset in the local dev server: file upload, staging grid render, anomaly badge display, individual anomaly resolution interactions, the approval gate, commit execution, and the on-screen report render. The browser network tab and Next.js server console were monitored throughout each step to detect unexpected query cascades, authentication failures, and React hook regressions. The committed `ImportReport` record was retrieved from Neon DB via `npx prisma studio` and compared against the on-screen report to confirm that the persisted and rendered summaries matched.

### Step 5 — Documentation Cross-Check

After implementation, all five required deliverables (`README.md`, `SCOPE.md`, `DECISIONS.md`, `IMPORT_REPORT.md`, `AI_USAGE.md`) were reviewed against the assignment specification checklist to confirm that no requirement was missed and that no AI-generated content made claims unsupported by the actual codebase.
