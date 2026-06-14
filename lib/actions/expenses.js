import { db } from "../db";
import { getCurrentUser } from "./users";

// Helper to map Prisma records to match Convex document structure
const mapDoc = (doc) => {
  if (!doc) return doc;
  return {
    ...doc,
    _id: doc.id,
    _creationTime: doc.createdAt ? doc.createdAt.getTime() : undefined,
  };
};

export async function createExpense(args) {
  const user = await getCurrentUser();

  // If there's a group, verify the user is a member
  if (args.groupId) {
    const group = await db.group.findUnique({
      where: { id: args.groupId },
    });
    if (!group) {
      throw new Error("Group not found");
    }

    // Load members array
    const membersArray = Array.isArray(group.members) ? group.members : [];
    const isMember = membersArray.some((member) => member.userId === user.id);
    if (!isMember) {
      throw new Error("You are not a member of this group");
    }
  }

  // Verify that splits add up to the total amount
  const totalSplitAmount = args.splits.reduce((sum, split) => sum + split.amount, 0);
  const tolerance = 0.01;
  if (Math.abs(totalSplitAmount - args.amount) > tolerance) {
    throw new Error("Split amounts must add up to the total expense amount");
  }

  // Create the expense in transaction
  const result = await db.$transaction(async (tx) => {
    const newExpense = await tx.expense.create({
      data: {
        description: args.description,
        amount: args.amount,
        category: args.category || "Other",
        date: new Date(args.date),
        paidByUserId: args.paidByUserId,
        splitType: args.splitType,
        splits: args.splits, // JSON field
        groupId: args.groupId || null,
        createdByUserId: user.id,
      },
    });

    // Create normalized splits in ExpenseSplit table
    await Promise.all(
      args.splits.map((split) =>
        tx.expenseSplit.create({
          data: {
            expenseId: newExpense.id,
            userId: split.userId,
            amount: split.amount,
            splitType: args.splitType,
            paid: split.paid || false,
          },
        })
      )
    );

    return newExpense;
  });

  return result.id;
}

export async function getExpensesBetweenUsers({ userId }) {
  const me = await getCurrentUser();
  if (me.id === userId) throw new Error("Cannot query yourself");

  // Load all one-on-one expenses
  const myPaid = await db.expense.findMany({
    where: { paidByUserId: me.id, groupId: null },
  });

  const theirPaid = await db.expense.findMany({
    where: { paidByUserId: userId, groupId: null },
  });

  const candidateExpenses = [...myPaid, ...theirPaid];

  // Keep only where BOTH are involved (payer or in splits)
  const expensesRaw = candidateExpenses.filter((e) => {
    const splits = Array.isArray(e.splits) ? e.splits : [];
    const meInSplits = splits.some((s) => s.userId === me.id);
    const themInSplits = splits.some((s) => s.userId === userId);

    const meInvolved = e.paidByUserId === me.id || meInSplits;
    const themInvolved = e.paidByUserId === userId || themInSplits;

    return meInvolved && themInvolved;
  });

  const expenses = expensesRaw
    .map((e) => ({
      ...mapDoc(e),
      date: e.date.getTime(),
      splits: Array.isArray(e.splits) ? e.splits : [],
    }))
    .sort((a, b) => b.date - a.date);

  // Load one-on-one settlements
  const settlementsRaw = await db.settlement.findMany({
    where: {
      groupId: null,
      OR: [
        { paidByUserId: me.id, receivedByUserId: userId },
        { paidByUserId: userId, receivedByUserId: me.id },
      ],
    },
  });

  const settlements = settlementsRaw
    .map((s) => ({
      ...mapDoc(s),
      date: s.date.getTime(),
    }))
    .sort((a, b) => b.date - a.date);

  // Compute balance
  let balance = 0;
  for (const e of expenses) {
    if (e.paidByUserId === me.id) {
      const split = e.splits.find((s) => s.userId === userId && !s.paid);
      if (split) balance += split.amount;
    } else {
      const split = e.splits.find((s) => s.userId === me.id && !s.paid);
      if (split) balance -= split.amount;
    }
  }

  for (const s of settlements) {
    if (s.paidByUserId === me.id) {
      balance += s.amount;
    } else {
      balance -= s.amount;
    }
  }

  const other = await db.user.findUnique({ where: { id: userId } });
  if (!other) throw new Error("User not found");

  return {
    expenses,
    settlements,
    otherUser: {
      id: other.id,
      _id: other.id,
      name: other.name,
      email: other.email,
      imageUrl: other.imageUrl,
    },
    balance,
  };
}

export async function deleteExpense({ expenseId }) {
  const user = await getCurrentUser();

  const expense = await db.expense.findUnique({
    where: { id: expenseId },
  });

  if (!expense) {
    throw new Error("Expense not found");
  }

  if (expense.createdByUserId !== user.id && expense.paidByUserId !== user.id) {
    throw new Error("You don't have permission to delete this expense");
  }

  await db.$transaction(async (tx) => {
    // Find all settlements referencing this expense
    const allSettlements = await tx.settlement.findMany();
    const relatedSettlements = allSettlements.filter(
      (s) => Array.isArray(s.relatedExpenseIds) && s.relatedExpenseIds.includes(expenseId)
    );

    for (const settlement of relatedSettlements) {
      const updatedRelatedExpenseIds = settlement.relatedExpenseIds.filter((id) => id !== expenseId);

      if (updatedRelatedExpenseIds.length === 0) {
        await tx.settlement.delete({ where: { id: settlement.id } });
      } else {
        await tx.settlement.update({
          where: { id: settlement.id },
          data: { relatedExpenseIds: updatedRelatedExpenseIds },
        });
      }
    }

    // Delete normalized splits
    await tx.expenseSplit.deleteMany({ where: { expenseId } });

    // Delete the expense
    await tx.expense.delete({ where: { id: expenseId } });
  });

  return { success: true };
}
