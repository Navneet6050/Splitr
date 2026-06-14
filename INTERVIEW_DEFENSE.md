# Senior Architecture Interview Defense

This document compiles 50 anticipated reviewer questions, covering design choices, database layouts, performance optimizations, math limits, and security controls within Splitr.

---

## 🗄️ Category 1: Database & Schema Migration (10 Questions)

### Q1: Why did you keep JSON columns (`Group.members`, `Expense.splits`) when migrating to PostgreSQL instead of fully normalizing?
**Answer**: Frontend compatibility. Rebuilding all React components to consume joined tables would introduce high regression risks. Storing normalized tables (`GroupMembership` and `ExpenseSplit`) alongside JSON columns allowed optimizations for SQL reporting while keeping the client application stable.

### Q2: How do you prevent data drift between the JSON columns and normalized tables?
**Answer**: All writes are wrapped inside ACID transactions using Prisma's `$transaction` API. If one write fails, both changes are rolled back.

### Q3: What isolation level are you using for PostgreSQL transaction blocks?
**Answer**: Read Committed by default. When auditing group ledgers during commits, we explicitly lock critical parent rows using raw SQL select-for-updates where transaction conflicts are expected.

### Q4: Why did you choose Prisma ORM over raw SQL query builders like Knex or pg-typed?
**Answer**: Developer velocity and type safety. Prisma provides excellent migration tracing, schema definitions, and automated typescript interfaces out of the box.

### Q5: How do you handle migrations on a serverless DB (Neon) without causing application downtime?
**Answer**: We implement a widen-migrate-narrow pattern: first adding nullable fields, running backfills in the background, and finally deprecating old columns after code verification.

### Q6: Why does `GroupMembership` support a `leftAt` timestamp instead of deleting the row?
**Answer**: Temporal integrity. Retaining membership history is necessary to validate that historical expenses mapped to a member occurred within their join intervals.

### Q7: What is the primary purpose of the `directUrl` in `schema.prisma`?
**Answer**: Bypass connection pooling. It establishes a direct connection to Neon DB for schema migrations and DDL statements, avoiding PgBouncer pool limitations.

### Q8: How did you select the index keys for `CurrencyRate`?
**Answer**: We indexed `[fromCurrency, toCurrency, effectiveDate]` because rate lookups always search by this exact matching sequence to find the active rate.

### Q9: Why is `ImportRow.raw` a JSON column instead of standard text?
**Answer**: Since CSV formats vary across organizations, storing the raw parsed row as key-value JSON retains unstructured input records for future audit reviews.

### Q10: How are database UUIDs generated?
**Answer**: Generated in-app by the Prisma client using UUIDv4 standard, preventing database sequence enumeration attacks.

---

## 📂 Category 2: CSV Ingestion & Anomaly Detection (10 Questions)

### Q11: How does the anomaly engine handle unparsable date formats?
**Answer**: The [dateFormatDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/dateFormatDetector.js) runs standard Date constructor checks. If it fails, the row is marked as `INVALID_DATE` (blocking) and must be fixed by the reviewer before commit.

### Q12: Why is `DUPLICATE_EXPENSE` classified as blocking rather than a warning?
**Answer**: To prevent double-charging. Accidental double clicks during CSV generation are common, so we block commits until the user clicks 'Skip' or 'Force Approve'.

### Q13: What happens to a row marked as `SETTLEMENT_LOGGED_AS_EXPENSE`?
**Answer**: The user is prompted to 'Convert to Settlement'. Committing routes this row to the `Settlement` table instead of `Expense`, bypassing split logic.

### Q14: How does name normalization handle typos (e.g. "Priya S" vs "Priya")?
**Answer**: The [aliasDetector.js](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/aliasDetector.js) checks group `Alias` tables. If a match is found, it canonicalizes the string to map the target user.

### Q15: Why is the CSV parsing done synchronously in a Server Action?
**Answer**: The initial scope focused on sheets under 500 lines. Synchronous processing provides instant feedback for small files. For larger files, we plan to move this to an asynchronous queue.

### Q16: How do you protect the system from Zip bombs or massive file uploads?
**Answer**: We enforce a strict size ceiling of 500 rows (`MAX_IMPORT_ROWS = 500`) directly at the server-side entry point.

### Q17: What does the confidence score in the `Alias` table represent?
**Answer**: String similarity score (Jaro-Winkler distance) calculated during lookup, allowing the UI to flag names with lower match certainty.

### Q18: Can a user commit an import with unresolved warning anomalies?
**Answer**: Yes. Warning anomalies (like `NEAR_DUPLICATE`) indicate potential issues but do not block the commit, unlike blocking anomalies.

### Q19: Where is the anomaly validation code located?
**Answer**: Inside [lib/import/detectors/](file:///c:/Users/manav/OneDrive/Desktop/ai-splitwise-clone/lib/import/detectors/). This folder houses decoupled, single-responsibility rule files.

### Q20: How are dynamic inputs corrected during a review?
**Answer**: Corrected values are written to `AnomalyReview` and patched onto the `ImportRow.parsed` JSON object prior to committing.

---

## ⚖️ Category 3: Debt Netting & Balance Calculations (10 Questions)

### Q21: What algorithm does `balances.js` use to simplify debts?
**Answer**: A greedy ledger minimization algorithm. It aggregates net positions, separates creditors from debtors, and iteratively pairs the largest debtor with the largest creditor to resolve balances.

### Q22: What is the time complexity of the greedy debt simplification algorithm?
**Answer**: $O(N \log N)$ where $N$ is the number of members in a group, driven by sorting the debtor and creditor lists at each reduction step.

### Q23: Why do we normalize currencies to INR before running the netting algorithm?
**Answer**: Netting requires a single currency context. Running the algorithm with mixed currencies would produce incorrect pairwise results.

### Q24: How does the system resolve split math rounding errors (e.g. dividing 100 INR among 3 people)?
**Answer**: The system rounds allocations to two decimal places, checks the sum, and assigns the remaining penny difference (e.g. $0.01$ INR) to the payer.

### Q25: Why is debt simplification calculated dynamically on read instead of cached on write?
**Answer**: Group balances change frequently. Dynamic read calculations ensure the UI always displays up-to-date metrics, avoiding cache invalidation issues.

### Q26: Can a group member settle a debt partially?
**Answer**: Yes. A settlement is recorded with the partial amount, and the netting algorithm adjusts remaining balances dynamically.

### Q27: How does a temporal membership boundary affect debt calculations?
**Answer**: The balance engine only nets expenses that occurred within a member's active join/leave interval, preventing retroactive debt assignment.

### Q28: How do we track who owes what for an expense?
**Answer**: Relational records in the `ExpenseSplit` table track individual user shares, amounts, and settlement statuses.

### Q29: What split configurations are supported?
**Answer**: Equal splits, percentage allocations, and exact custom value assignments.

### Q30: How are circular debts resolved?
**Answer**: The greedy netting algorithm naturally dissolves circular paths (e.g. A owes B, B owes C, C owes A) by netting all positions to $0.00$.

---

## 🛡️ Category 4: Security & Authentication (10 Questions)

### Q31: How is user identity established on Server Actions?
**Answer**: The server checks the authenticated Clerk session JWT, retrieves the `tokenIdentifier`, and fetches the corresponding `User` record.

### Q32: How does the system prevent Insecure Direct Object References (IDOR)?
**Answer**: By executing `assertGroupMember(groupId, userId)` on all group operations, ensuring users can only access data for groups they belong to.

### Q33: How does the system defend against Cross-Site Request Forgery (CSRF)?
**Answer**: Next.js Server Actions use host-header validation and anti-CSRF tokens natively, blocking cross-origin action calls.

### Q34: Are CSV strings sanitized before database insertion?
**Answer**: Yes. Fields are parsed into typed parameters using Prisma ORM, preventing SQL injection exploits.

### Q35: How does the system securely handle file storage for uploaded CSV files?
**Answer**: CSV text is parsed in memory and staged directly to database rows. Raw text files are not saved to disk or persistent cloud buckets, eliminating file storage risks.

### Q36: How do you verify Clerk JWT tokens on the server?
**Answer**: Via Clerk's Node SDK wrapper, which validates token signatures and expirations using public keys retrieved from Clerk's JWKS endpoint.

### Q37: How is administrative access (Group Owner vs Member) enforced?
**Answer**: By checking the `createdByUserId` field on the `Group` model during administrative operations like committing imports or adding members.

### Q38: Are user passwords stored in the database?
**Answer**: No. All password management, hashing, and MFA verification are handled by Clerk.

### Q39: How does the system mitigate brute force attacks on Server Actions?
**Answer**: We rely on Vercel's global web application firewall (WAF) and Clerk's login rate limiting mechanisms.

### Q40: What happens to a user's data when they delete their account?
**Answer**: User profiles are soft-deleted or anonymized to maintain historical ledger integrity for shared expenses.

---

## 🚀 Category 5: Scalability & Production Operations (10 Questions)

### Q41: How did you fix the Neon DB timeout issues during CSV imports?
**Answer**: We replaced sequential database writes inside staging loops with Prisma bulk queries (`createMany` and `createManyAndReturn`), reducing database roundtrips from 170+ queries down to 3.

### Q42: How will the database scale when storage growth exceeds 500GB?
**Answer**: Since groups are independent collaborative contexts, we can shard PostgreSQL tables using `groupId` as the partition key.

### Q43: What caching strategy is planned for high-traffic groups?
**Answer**: We plan to implement a Redis caching layer (e.g. Upstash) to store pre-calculated netting balances, invalidating the cache only when new expenses or settlements are logged.

### Q44: How are background jobs managed?
**Answer**: Via Inngest, which handles retries and job orchestration outside the main web request thread.

### Q45: How does the system handle Gemini API rate limits?
**Answer**: Inngest background functions run with back-off retry configurations to safely handle rate limits or API outages.

### Q46: Why is Neon DB suited for this application?
**Answer**: Serverless compute scaling automatically scales down database resources during low-traffic periods to minimize operational costs.

### Q47: How is database connection exhaustion avoided in serverless environments?
**Answer**: By configuring PgBouncer connection pooling via the transaction connection string (`?pgbouncer=true`).

### Q48: What hosting provider is recommended?
**Answer**: Vercel. It provides native support for Next.js features and handles global traffic spikes out of the box.

### Q49: How are environment variables protected in production?
**Answer**: Variables are stored securely in Vercel's encrypted dashboard and injected into serverless environments at runtime.

### Q50: How do you monitor production latency spikes?
**Answer**: By configuring OpenTelemetry logs and streaming traces to an APM platform (e.g. Datadog or Axiom).
