# Shared Expenses Platform

This is a Next.js, Convex, Clerk, and TailwindCSS Splitwise-style app extended for the Spreetail assignment import workflow.

## What Exists

- Clerk authentication
- Group and contact management
- Manual expenses and settlements
- Equal, percentage, and exact manual splits
- CSV import workspace at `/import`
- Import staging, anomaly detection, approval, commit, and report generation
- Currency audit fields for INR/USD imports
- Historical membership records for imported participants
- Normalized `expenseSplits` for imported expenses and drilldown-ready balances

## Setup

Create `.env` and `.env.local` with the required keys:

```env
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CLERK_JWT_ISSUER_DOMAIN=

RESEND_API_KEY=
GEMINI_API_KEY=
```

Install and run:

```bash
npm install
npx convex dev
npm run dev
```

## Import Flow

1. Sign in.
2. Create or open a group.
3. Go to `/import`.
4. Select the group and upload `expenses_export.csv`.
5. Review staged rows and anomalies.
6. Resolve blocking anomalies with approve, skip, or convert.
7. Approve the import.
8. Commit the import.
9. Read the generated JSON report in the import page.

## Important Convex Modules

- `convex/imports.js`: CSV parsing, staging, anomaly detection, review, approval, commit, report generation.
- `convex/balances.js`: normalized balance summary and pairwise drilldown.
- `convex/schema.js`: assignment-grade data model extensions.

## Verification

The implementation was checked with:

```bash
npx convex codegen
npm run lint
```
