import { db } from "../db";
import { inngest } from "./client";
import { Resend } from "resend";

export const paymentReminders = inngest.createFunction(
  { id: "send-payment-reminders" },
  { cron: "0 10 * * *" }, // daily at 10 AM UTC
  async ({ step }) => {
    /* 1. Fetch all users that still owe money */
    const users = await step.run("fetch-debts", async () => {
      const outstandingSplits = await db.expenseSplit.findMany({
        where: { paid: false },
        include: {
          expense: {
            include: {
              paidByUser: true,
            },
          },
          user: true,
        },
      });

      const userDebts = {};
      for (const split of outstandingSplits) {
        const debtor = split.user;
        const creditor = split.expense.paidByUser;
        if (!debtor.email || debtor.email.endsWith("@import.local")) continue;

        if (!userDebts[debtor.id]) {
          userDebts[debtor.id] = {
            _id: debtor.id,
            id: debtor.id,
            name: debtor.name,
            email: debtor.email,
            debts: [],
          };
        }

        const existing = userDebts[debtor.id].debts.find((d) => d.userId === creditor.id);
        if (existing) {
          existing.amount += split.amount;
        } else {
          userDebts[debtor.id].debts.push({
            userId: creditor.id,
            name: creditor.name,
            amount: split.amount,
          });
        }
      }

      return Object.values(userDebts);
    });

    /* 2. Build & send one email per user */
    const resend = new Resend(process.env.RESEND_API_KEY);

    const results = await step.run("send-emails", async () => {
      return Promise.all(
        users.map(async (u) => {
          const rows = u.debts
            .map(
              (d) => `
                <tr>
                  <td style="padding:4px 8px;">${d.name}</td>
                  <td style="padding:4px 8px;">$${d.amount.toFixed(2)}</td>
                </tr>
              `
            )
            .join("");

          if (!rows) return { userId: u.id, skipped: true };

          const html = `
            <h2>Splitr – Payment Reminder</h2>
            <p>Hi ${u.name}, you have the following outstanding balances:</p>
            <table cellspacing="0" cellpadding="0" border="1" style="border-collapse:collapse;">
              <thead>
                <tr><th>To</th><th>Amount</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p>Please settle up soon. Thanks!</p>
          `;

          try {
            await resend.emails.send({
              from: "Splitr <onboarding@resend.dev>",
              to: u.email,
              subject: "You have pending payments on Splitr",
              html,
            });
            return { userId: u.id, success: true };
          } catch (err) {
            return { userId: u.id, success: false, error: err.message };
          }
        })
      );
    });

    return {
      processed: results.length,
      successes: results.filter((r) => r.success).length,
      failures: results.filter((r) => r.success === false).length,
    };
  }
);
