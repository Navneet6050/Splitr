import { query } from "./_generated/server";
import { v } from "convex/values";

async function getCurrentUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) throw new Error("User not found");
  return user;
}

async function assertGroupMember(ctx, groupId, userId) {
  const group = await ctx.db.get(groupId);
  if (!group) throw new Error("Group not found");
  const isMember = group.members.some((member) => member.userId === userId);
  if (!isMember) throw new Error("You are not a member of this group");
  return group;
}

async function getExpenseSplits(ctx, expense) {
  const normalized = await ctx.db
    .query("expenseSplits")
    .withIndex("by_expenseId", (q) => q.eq("expenseId", expense._id))
    .take(100);
  if (normalized.length > 0) return normalized;
  return expense.splits.map((split) => ({
    expenseId: expense._id,
    userId: split.userId,
    amount: split.amount,
    paid: split.paid,
    splitType: expense.splitType,
  }));
}

export const getGroupBalances = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const group = await assertGroupMember(ctx, args.groupId, user._id);
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group_and_date", (q) => q.eq("groupId", args.groupId))
      .take(1000);
    const settlements = await ctx.db
      .query("settlements")
      .withIndex("by_group_and_date", (q) => q.eq("groupId", args.groupId))
      .take(1000);

    const memberIds = new Set(group.members.map((member) => member.userId));
    for (const expense of expenses) {
      memberIds.add(expense.paidByUserId);
      for (const split of await getExpenseSplits(ctx, expense)) {
        memberIds.add(split.userId);
      }
    }

    const net = {};
    for (const memberId of memberIds) net[memberId] = 0;

    for (const expense of expenses) {
      const splits = await getExpenseSplits(ctx, expense);
      for (const split of splits) {
        if (split.userId === expense.paidByUserId || split.paid) continue;
        net[expense.paidByUserId] = (net[expense.paidByUserId] ?? 0) + split.amount;
        net[split.userId] = (net[split.userId] ?? 0) - split.amount;
      }
    }

    for (const settlement of settlements) {
      net[settlement.paidByUserId] =
        (net[settlement.paidByUserId] ?? 0) + settlement.amount;
      net[settlement.receivedByUserId] =
        (net[settlement.receivedByUserId] ?? 0) - settlement.amount;
    }

    const balances = [];
    for (const [userId, amount] of Object.entries(net)) {
      const member = await ctx.db.get(userId);
      balances.push({
        userId,
        name: member?.name ?? "Unknown",
        imageUrl: member?.imageUrl,
        netBalance: Number(amount.toFixed(2)),
      });
    }

    return {
      group: { id: group._id, name: group.name },
      balances: balances.sort((a, b) => b.netBalance - a.netBalance),
      optimizedSettlements: optimizeSettlements(balances),
    };
  },
});

export const getDrilldown = query({
  args: {
    groupId: v.id("groups"),
    userAId: v.id("users"),
    userBId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertGroupMember(ctx, args.groupId, user._id);

    const userA = await ctx.db.get(args.userAId);
    const userB = await ctx.db.get(args.userBId);
    if (!userA || !userB) throw new Error("User not found");

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group_and_date", (q) => q.eq("groupId", args.groupId))
      .take(1000);
    const settlements = await ctx.db
      .query("settlements")
      .withIndex("by_group_and_date", (q) => q.eq("groupId", args.groupId))
      .take(1000);

    const entries = [];
    for (const expense of expenses) {
      const splits = await getExpenseSplits(ctx, expense);
      const splitA = splits.find((split) => split.userId === args.userAId);
      const splitB = splits.find((split) => split.userId === args.userBId);

      if (expense.paidByUserId === args.userAId && splitB && !splitB.paid) {
        entries.push({
          type: "expense",
          date: expense.date,
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
          date: expense.date,
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
      if (
        settlement.paidByUserId === args.userAId &&
        settlement.receivedByUserId === args.userBId
      ) {
        entries.push({
          type: "settlement",
          date: settlement.date,
          description: settlement.note || "Settlement",
          amount: settlement.amount,
          share: settlement.amount,
          delta: settlement.amount,
          direction: `${userA.name} paid ${userB.name}`,
          sourceImportRowId: settlement.sourceImportRowId,
        });
      }
      if (
        settlement.paidByUserId === args.userBId &&
        settlement.receivedByUserId === args.userAId
      ) {
        entries.push({
          type: "settlement",
          date: settlement.date,
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
        userA: { id: userA._id, name: userA.name },
        userB: { id: userB._id, name: userB.name },
      },
      entries: chronologicalEntries,
      finalBalance: Number(runningBalance.toFixed(2)),
    };
  },
});

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
