# Production Readiness Review

This document contains the production readiness scorecard, backup configurations, error boundaries, deployment checklists, and reliability ratings for Splitr.

---

## 📈 Production Readiness Scorecard

| Category | Requirement | Status | Score (0-10) |
| :--- | :--- | :--- | :--- |
| **Authentication** | Enforce auth checks on every client endpoint | Completed (Clerk JWT) | 10/10 |
| **Data Integrity** | Transaction safety + relational schema checks | Completed (Prisma transaction wrapping) | 10/10 |
| **Performance** | Batch staging writes to avoid DB timeouts | Completed (Prisma `createMany`) | 9/10 |
| **Observability** | Structured logging, trace captures, metrics | Partially Completed (Basic console logs) | 6/10 |
| **Fault Tolerance** | Graceful handling of external service failures | Completed (Inngest retries, API fallbacks) | 8/10 |
| **Infrastructure** | Environment variables, pool sizes configured | Completed | 9/10 |

* **Overall Score**: **87 / 100** (Ready for initial production deployment; recommend APM instrumentation before high-traffic scaling).

---

## 🛠️ Error Handling & Database Codes

All Server Actions wrap queries inside standardized try-catch blocks. Below is the mapping of handled database exceptions:

* **Prisma Error `P2002` (Unique Constraint Violation)**: 
  - *Context*: Creating duplicate user accounts or duplicate groups.
  - *Action*: Caught, logged, and returned to client as "Resource already exists".
* **Prisma Error `P2025` (Record to update not found)**:
  - *Context*: Editing or deleting an expense or settlement that was already removed.
  - *Action*: Returned to UI as "Entity not found".
* **Database Connection Timeout (Neon)**:
  - *Context*: Exceeding pooled connection limits.
  - *Action*: Client displays an overlay recommending retry; Inngest retries automatically with back-off.

---

## 💾 Backup & Disaster Recovery

* **Database Backups (Neon)**:
  - Neon DB utilizes automated daily storage snapshots with WAL archiving, supporting Point-in-Time Recovery (PITR) up to 7 days.
* **Recovery Time Objective (RTO)**: Target < 30 minutes.
* **Recovery Point Objective (RPO)**: Target < 5 minutes (due to continuous WAL archiving).

---

## 🚀 Deployment Environment Variables Configuration

The following environment variables must be populated in the Vercel deployment console before builds:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require&pgbouncer=true` | Primary pool URL for Next.js Server Actions. |
| `DIRECT_URL` | `postgresql://user:pass@host/db?sslmode=require` | Direct connection URL for running migrations. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk authentication frontend key. |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk verification backend key. |
| `INNGEST_EVENT_KEY` | `event_key_...` | Inngest worker task dispatch key. |
| `INNGEST_SIGNING_KEY` | `sign_key_...` | Validates Inngest executions. |
| `GEMINI_API_KEY` | `AIzaSy...` | API key for generating monthly trends. |
