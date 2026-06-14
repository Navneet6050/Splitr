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

export async function getUserBalances() {
  const user = await getCurrentUser();

  // Load all one-on-one expenses where user is paidBy or in splits
  const allExpenses = await db.expense.findMany({
    where: { groupId: null },
  });

  const expenses = allExpenses.filter((e) => {
    const splits = Array.isArray(e.splits) ? e.splits : [];
    return e.paidByUserId === user.id || splits.some((s) => s.userId === user.id);
  });

  let youOwe = 0;
  let youAreOwed = 0;
  const balanceByUser = {};

  for (const e of expenses) {
    const splits = Array.isArray(e.splits) ? e.splits : [];
    const isPayer = e.paidByUserId === user.id;
    const mySplit = splits.find((s) => s.userId === user.id);

    if (isPayer) {
      for (const s of splits) {
        if (s.userId === user.id || s.paid) continue;
        youAreOwed += s.amount;
        (balanceByUser[s.userId] ??= { owed: 0, owing: 0 }).owed += s.amount;
      }
    } else if (mySplit && !mySplit.paid) {
      youOwe += mySplit.amount;
      (balanceByUser[e.paidByUserId] ??= { owed: 0, owing: 0 }).owing += mySplit.amount;
    }
  }

  // Load one-on-one settlements
  const settlements = await db.settlement.findMany({
    where: {
      groupId: null,
      OR: [{ paidByUserId: user.id }, { receivedByUserId: user.id }],
    },
  });

  for (const s of settlements) {
    if (s.paidByUserId === user.id) {
      youOwe -= s.amount;
      (balanceByUser[s.receivedByUserId] ??= { owed: 0, owing: 0 }).owing -= s.amount;
    } else {
      youAreOwed -= s.amount;
      (balanceByUser[s.paidByUserId] ??= { owed: 0, owing: 0 }).owed -= s.amount;
    }
  }

  // Build list of users for UI
  const youOweList = [];
  const youAreOwedByList = [];

  for (const [uid, { owed, owing }] of Object.entries(balanceByUser)) {
    const net = owed - owing;
    if (Math.abs(net) < 0.01) continue;

    const counterpart = await db.user.findUnique({ where: { id: uid } });
    const base = {
      userId: uid,
      _id: uid,
      name: counterpart?.name ?? "Unknown",
      imageUrl: counterpart?.imageUrl || null,
      amount: Math.abs(net),
    };

    if (net > 0) {
      youAreOwedByList.push(base);
    } else {
      youOweList.push(base);
    }
  }

  youOweList.sort((a, b) => b.amount - a.amount);
  youAreOwedByList.sort((a, b) => b.amount - a.amount);

  return {
    youOwe: Math.max(0, youOwe),
    youAreOwed: Math.max(0, youAreOwed),
    totalBalance: youAreOwed - youOwe,
    oweDetails: { youOwe: youOweList, youAreOwedBy: youAreOwedByList },
  };
}

export async function getTotalSpent() {
  const user = await getCurrentUser();

  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  const expenses = await db.expense.findMany({
    where: {
      date: { gte: startOfYear },
    },
  });

  // Filter for expenses where user is involved
  const userExpenses = expenses.filter((e) => {
    const splits = Array.isArray(e.splits) ? e.splits : [];
    return e.paidByUserId === user.id || splits.some((s) => s.userId === user.id);
  });

  let totalSpent = 0;
  userExpenses.forEach((e) => {
    const splits = Array.isArray(e.splits) ? e.splits : [];
    const userSplit = splits.find((s) => s.userId === user.id);
    if (userSplit) {
      totalSpent += userSplit.amount;
    }
  });

  return totalSpent;
}

export async function getMonthlySpending() {
  const user = await getCurrentUser();

  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  const allExpenses = await db.expense.findMany({
    where: {
      date: { gte: startOfYear },
    },
  });

  const userExpenses = allExpenses.filter((e) => {
    const splits = Array.isArray(e.splits) ? e.splits : [];
    return e.paidByUserId === user.id || splits.some((s) => s.userId === user.id);
  });

  const monthlyTotals = {};
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(currentYear, i, 1);
    monthlyTotals[monthDate.getTime()] = 0;
  }

  userExpenses.forEach((e) => {
    const date = e.date;
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();

    const splits = Array.isArray(e.splits) ? e.splits : [];
    const userSplit = splits.find((s) => s.userId === user.id);
    if (userSplit) {
      monthlyTotals[monthStart] = (monthlyTotals[monthStart] || 0) + userSplit.amount;
    }
  });

  const result = Object.entries(monthlyTotals).map(([month, total]) => ({
    month: parseInt(month),
    total,
  }));

  result.sort((a, b) => a.month - b.month);
  return result;
}

export async function getUserGroups() {
  const user = await getCurrentUser();

  // Find all group ids where user is a member
  const memberships = await db.groupMembership.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const memberGroupIds = memberships.map((m) => m.groupId);

  const groups = await db.group.findMany({
    where: {
      OR: [
        { id: { in: memberGroupIds } },
        { createdByUserId: user.id },
        { members: { path: "$[*].userId", equals: user.id } },
      ],
    },
  });

  const enhancedGroups = await Promise.all(
    groups.map(async (group) => {
      const expenses = await db.expense.findMany({
        where: { groupId: group.id },
      });

      let balance = 0;
      expenses.forEach((e) => {
        const splits = Array.isArray(e.splits) ? e.splits : [];
        if (e.paidByUserId === user.id) {
          splits.forEach((split) => {
            if (split.userId !== user.id && !split.paid) {
              balance += split.amount;
            }
          });
        } else {
          const userSplit = splits.find((split) => split.userId === user.id);
          if (userSplit && !userSplit.paid) {
            balance -= userSplit.amount;
          }
        }
      });

      // Load settlements
      const settlements = await db.settlement.findMany({
        where: {
          groupId: group.id,
          OR: [{ paidByUserId: user.id }, { receivedByUserId: user.id }],
        },
      });

      settlements.forEach((settlement) => {
        if (settlement.paidByUserId === user.id) {
          balance += settlement.amount;
        } else {
          balance -= settlement.amount;
        }
      });

      let membersArray = Array.isArray(group.members) ? group.members : [];
      return {
        ...mapDoc(group),
        balance,
        members: membersArray,
      };
    })
  );

  return enhancedGroups;
}
