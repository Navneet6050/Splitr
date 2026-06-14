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

async function assertGroupMember(groupId, userId) {
  const group = await db.group.findUnique({
    where: { id: groupId },
  });
  if (!group) throw new Error("Group not found");

  const membersArray = Array.isArray(group.members) ? group.members : [];
  const isMember = membersArray.some((member) => member.userId === userId);
  if (!isMember) throw new Error("You are not a member of this group");
  return group;
}

async function getExpenseSplits(expense) {
  const normalized = await db.expenseSplit.findMany({
    where: { expenseId: expense.id },
    take: 100,
  });
  if (normalized.length > 0) {
    return normalized.map((s) => ({
      ...mapDoc(s),
      expenseId: s.expenseId,
      userId: s.userId,
      amount: s.amount,
      paid: s.paid,
      splitType: s.splitType,
    }));
  }

  const splits = Array.isArray(expense.splits) ? expense.splits : [];
  return splits.map((split) => ({
    expenseId: expense.id,
    userId: split.userId,
    amount: split.amount,
    paid: split.paid,
    splitType: expense.splitType,
  }));
}

export async function getGroupBalances({ groupId }) {
  const user = await getCurrentUser();
  const group = await assertGroupMember(groupId, user.id);

  const expenses = await db.expense.findMany({
    where: { groupId },
    orderBy: { date: "asc" },
  });

  const settlements = await db.settlement.findMany({
    where: { groupId },
    orderBy: { date: "asc" },
  });

  const membersArray = Array.isArray(group.members) ? group.members : [];
  const memberIds = new Set(membersArray.map((m) => m.userId));

  for (const expense of expenses) {
    memberIds.add(expense.paidByUserId);
    const splits = await getExpenseSplits(expense);
    for (const split of splits) {
      memberIds.add(split.userId);
    }
  }

  const net = {};
  for (const memberId of memberIds) net[memberId] = 0;

  for (const expense of expenses) {
    const splits = await getExpenseSplits(expense);
    for (const split of splits) {
      if (split.userId === expense.paidByUserId || split.paid) continue;
      net[expense.paidByUserId] = (net[expense.paidByUserId] ?? 0) + split.amount;
      net[split.userId] = (net[split.userId] ?? 0) - split.amount;
    }
  }

  for (const settlement of settlements) {
    net[settlement.paidByUserId] = (net[settlement.paidByUserId] ?? 0) + settlement.amount;
    net[settlement.receivedByUserId] = (net[settlement.receivedByUserId] ?? 0) - settlement.amount;
  }

  const balances = [];
  for (const [userId, amount] of Object.entries(net)) {
    const member = await db.user.findUnique({ where: { id: userId } });
    balances.push({
      userId,
      _id: userId,
      name: member?.name ?? "Unknown",
      imageUrl: member?.imageUrl || null,
      netBalance: Number(amount.toFixed(2)),
    });
  }

  return {
    group: { id: group.id, _id: group.id, name: group.name },
    balances: balances.sort((a, b) => b.netBalance - a.netBalance),
    optimizedSettlements: optimizeSettlements(balances),
  };
}

export async function getDrilldown(args) {
  const user = await getCurrentUser();
  await assertGroupMember(args.groupId, user.id);

  const userA = await db.user.findUnique({ where: { id: args.userAId } });
  const userB = await db.user.findUnique({ where: { id: args.userBId } });
  if (!userA || !userB) throw new Error("User not found");

  const expenses = await db.expense.findMany({
    where: { groupId: args.groupId },
    orderBy: { date: "asc" },
  });

  const settlements = await db.settlement.findMany({
    where: { groupId: args.groupId },
    orderBy: { date: "asc" },
  });

  const entries = [];
  for (const expense of expenses) {
    const splits = await getExpenseSplits(expense);
    const splitA = splits.find((split) => split.userId === args.userAId);
    const splitB = splits.find((split) => split.userId === args.userBId);

    if (expense.paidByUserId === args.userAId && splitB && !splitB.paid) {
      entries.push({
        type: "expense",
        date: expense.date.getTime(),
        description: expense.description,
        amount: expense.amount,
        share: splitB.amount,
        delta: splitB.amount,
        direction: `${userB.name} owes ${userA.name}`,
        sourceImportRowId: expense.sourceImportRowId,
      });
    }
    if (expense.paidByUserId === args.userBId && splitA && !splitA.paid) {
      entries.push({
        type: "expense",
        date: expense.date.getTime(),
        description: expense.description,
        amount: expense.amount,
        share: splitA.amount,
        delta: -splitA.amount,
        direction: `${userA.name} owes ${userB.name}`,
        sourceImportRowId: expense.sourceImportRowId,
      });
    }
  }

  for (const settlement of settlements) {
    if (settlement.paidByUserId === args.userAId && settlement.receivedByUserId === args.userBId) {
      entries.push({
        type: "settlement",
        date: settlement.date.getTime(),
        description: settlement.note || "Settlement",
        amount: settlement.amount,
        share: settlement.amount,
        delta: settlement.amount,
        direction: `${userA.name} paid ${userB.name}`,
        sourceImportRowId: settlement.sourceImportRowId,
      });
    }
    if (settlement.paidByUserId === args.userBId && settlement.receivedByUserId === args.userAId) {
      entries.push({
        type: "settlement",
        date: settlement.date.getTime(),
        description: settlement.note || "Settlement",
        amount: settlement.amount,
        share: settlement.amount,
        delta: -settlement.amount,
        direction: `${userB.name} paid ${userA.name}`,
        sourceImportRowId: settlement.sourceImportRowId,
      });
    }
  }

  let runningBalance = 0;
  const chronologicalEntries = entries
    .sort((a, b) => a.date - b.date)
    .map((entry) => {
      runningBalance += entry.delta;
      return {
        ...entry,
        runningBalance: Number(runningBalance.toFixed(2)),
      };
    });

  return {
    users: {
      userA: { id: userA.id, _id: userA.id, name: userA.name },
      userB: { id: userB.id, _id: userB.id, name: userB.name },
    },
    entries: chronologicalEntries,
    finalBalance: Number(runningBalance.toFixed(2)),
  };
}

function optimizeSettlements(balances) {
  const creditors = balances
    .filter((item) => item.netBalance > 0.01)
    .map((item) => ({ ...item, amount: item.netBalance }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((item) => item.netBalance < -0.01)
    .map((item) => ({ ...item, amount: Math.abs(item.netBalance) }))
    .sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const amount = Math.min(creditors[creditorIndex].amount, debtors[debtorIndex].amount);
    settlements.push({
      fromUserId: debtors[debtorIndex].userId,
      fromName: debtors[debtorIndex].name,
      toUserId: creditors[creditorIndex].userId,
      toName: creditors[creditorIndex].name,
      amount: Number(amount.toFixed(2)),
    });
    creditors[creditorIndex].amount -= amount;
    debtors[debtorIndex].amount -= amount;
    if (creditors[creditorIndex].amount <= 0.01) creditorIndex++;
    if (debtors[debtorIndex].amount <= 0.01) debtorIndex++;
  }
  return settlements;
}
