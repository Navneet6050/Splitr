# Operational Cost Analysis & Projections

This document presents the infrastructure cost models and projections for running Splitr across three distinct growth phases: 100 Users, 10,000 Users, and 1,000,000 Users.

---

## 📈 Cost Projection Summary (USD / Month)

| Service | Category | 100 Users | 10,000 Users | 1,000,000 Users |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Serverless Hosting | $0.00 (Hobby) | $20.00 (Pro) | $3,000.00 (Enterprise) |
| **Neon DB** | Serverless PostgreSQL | $0.00 (Free Tier) | $19.00 (Launch Plan) | $1,200.00 (Scale Tier) |
| **Clerk** | Authentication & Users | $0.00 (Free up to 10k MAU) | $0.00 (Free Tier) | $2,400.00 (Pro Tier + Volume) |
| **Resend** | SMTP Email Reminders | $0.00 (Free up to 3k/mo) | $20.00 (Up to 50k emails) | $800.00 (Bulk Sender plan) |
| **Gemini API**| Monthly Spending LLM | $0.00 (Free Tier) | $15.00 (Pay-as-you-go) | $1,500.00 (Volume pricing) |
| **Total** | | **$0.00 / month** | **$74.00 / month** | **$8,900.00 / month** |

---

## 🔍 Assumptions & Breakdowns by Phase

### Phase 1: Small Community (100 Monthly Active Users)
* **Assumptions**: 
  - 10 groups, 50 expenses logged monthly, 10 small CSV uploads.
* **Pricing Models**:
  - *Vercel*: Fits within Hobby tier limitations (100 GB bandwidth, 120,000 execution seconds).
  - *Neon*: Fits within Free tier (0.5 GB storage, shared compute).
  - *Clerk*: Clerk's free tier supports up to 10,000 Monthly Active Users (MAUs).
  - *Resend*: Free plan allows 3,000 emails/month (more than enough for 100 users).
  - *Gemini*: Covered by Google AI Studio free tier rate limits.

### Phase 2: Professional Scale (10,000 Monthly Active Users)
* **Assumptions**:
  - 1,500 active groups, 40,000 expenses, 1,000 CSV uploads.
* **Pricing Models**:
  - *Vercel*: $20/month for Pro tier (commercial usage rights, 1TB bandwidth).
  - *Neon*: Upgraded to Launch Plan ($19/mo base) with 10 GB storage and dedicated autoscaling compute.
  - *Resend*: $20/month for 50,000 emails.
  - *Gemini API*: $15/month (calculated at approx. $0.00015 per input/output call for monthly insights generation).

### Phase 3: Global SaaS Scale (1,000,000 Monthly Active Users)
* **Assumptions**:
  - 150,000 active groups, 4 million monthly expenses, 100,000 CSV uploads.
* **Pricing Models**:
  - *Vercel*: Enterprise tier contract (custom SLA, concurrent builds, advanced edge routing, custom DDoS safeguards).
  - *Neon DB*: Dedicated PostgreSQL instances ($1,200/mo) with active read-replicas, read routing, and 300+ GB storage capacity.
  - *Clerk*: Enterprise pricing ($0.02 per user above free threshold + custom MFA controls).
  - *Resend*: Dedicated IP addresses and custom high-volume SMTP agreements.
  - *Gemini API*: 1,000,000 MAUs pulling insights triggers high volume API throughput ($1,500/mo).
