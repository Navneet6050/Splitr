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

export async function createSettlement(args) {
  const caller = await getCurrentUser();

  if (args.amount <= 0) throw new Error("Amount must be positive");
  if (args.paidByUserId === args.receivedByUserId) {
    throw new Error("Payer and receiver cannot be the same user");
  }
  if (caller.id !== args.paidByUserId && caller.id !== args.receivedByUserId) {
    throw new Error("You must be either the payer or the receiver");
  }

  if (args.groupId) {
    const group = await db.group.findUnique({
      where: { id: args.groupId },
    });
    if (!group) throw new Error("Group not found");

    const membersArray = Array.isArray(group.members) ? group.members : [];
    const isMember = (uid) => membersArray.some((m) => m.userId === uid);
    if (!isMember(args.paidByUserId) || !isMember(args.receivedByUserId)) {
      throw new Error("Both parties must be members of the group");
    }
  }

  const newSettlement = await db.settlement.create({
    data: {
      amount: args.amount,
      note: args.note || null,
      date: new Date(),
      paidByUserId: args.paidByUserId,
      receivedByUserId: args.receivedByUserId,
      groupId: args.groupId || null,
      relatedExpenseIds: args.relatedExpenseIds || [],
      createdByUserId: caller.id,
    },
  });

  return newSettlement.id;
}

export async function getSettlementData(args) {
  const me = await getCurrentUser();

  if (args.entityType === "user") {
    const other = await db.user.findUnique({ where: { id: args.entityId } });
    if (!other) throw new Error("User not found");

    // Gather expenses where either of us paid or appears in splits
    const myExpenses = await db.expense.findMany({
      where: { paidByUserId: me.id, groupId: null },
    });

    const otherUserExpenses = await db.expense.findMany({
      where: { paidByUserId: other.id, groupId: null },
    });

    const expenses = [...myExpenses, ...otherUserExpenses];

    let owed = 0;
    let owing = 0;

    for (const exp of expenses) {
      const splits = Array.isArray(exp.splits) ? exp.splits : [];
      const involvesMe = exp.paidByUserId === me.id || splits.some((s) => s.userId === me.id);
      const involvesThem = exp.paidByUserId === other.id || splits.some((s) => s.userId === other.id);
      if (!involvesMe || !involvesThem) continue;

      if (exp.paidByUserId === me.id) {
        const split = splits.find((s) => s.userId === other.id && !s.paid);
        if (split) owed += split.amount;
      }

      if (exp.paidByUserId === other.id) {
        const split = splits.find((s) => s.userId === me.id && !s.paid);
        if (split) owing += split.amount;
      }
    }

    // Load one-on-one settlements
    const mySettlements = await db.settlement.findMany({
      where: { paidByUserId: me.id, groupId: null },
    });

    const otherUserSettlements = await db.settlement.findMany({
      where: { paidByUserId: other.id, groupId: null },
    });

    const settlements = [...mySettlements, ...otherUserSettlements];

    for (const st of settlements) {
      if (st.paidByUserId === me.id) {
        owing = Math.max(0, owing - st.amount);
      } else {
        owed = Math.max(0, owed - st.amount);
      }
    }

    return {
      type: "user",
      counterpart: {
        userId: other.id,
        _id: other.id,
        name: other.name,
        email: other.email,
        imageUrl: other.imageUrl,
      },
      youAreOwed: owed,
      youOwe: owing,
      netBalance: owed - owing,
    };
  } else if (args.entityType === "group") {
    const group = await db.group.findUnique({
      where: { id: args.entityId },
      include: {
        memberships: {
          include: {
            user: true,
          },
        },
      },
    });
    if (!group) throw new Error("Group not found");

    let membersArray = Array.isArray(group.members) ? group.members : [];
    if (membersArray.length === 0 && group.memberships) {
      membersArray = group.memberships.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.getTime(),
      }));
    }

    const isMember = membersArray.some((m) => m.userId === me.id);
    if (!isMember) throw new Error("You are not a member of this group");

    const expenses = await db.expense.findMany({
      where: { groupId: group.id },
    });

    const balances = {};
    membersArray.forEach((m) => {
      if (m.userId !== me.id) balances[m.userId] = { owed: 0, owing: 0 };
    });

    for (const exp of expenses) {
      const splits = Array.isArray(exp.splits) ? exp.splits : [];
      if (exp.paidByUserId === me.id) {
        splits.forEach((split) => {
          if (split.userId !== me.id && !split.paid && balances[split.userId]) {
            balances[split.userId].owed += split.amount;
          }
        });
      } else if (balances[exp.paidByUserId]) {
        const split = splits.find((s) => s.userId === me.id && !s.paid);
        if (split) balances[exp.paidByUserId].owing += split.amount;
      }
    }

    const settlements = await db.settlement.findMany({
      where: { groupId: group.id },
    });

    for (const st of settlements) {
      if (st.paidByUserId === me.id && balances[st.receivedByUserId]) {
        balances[st.receivedByUserId].owing = Math.max(0, balances[st.receivedByUserId].owing - st.amount);
      }
      if (st.receivedByUserId === me.id && balances[st.paidByUserId]) {
        balances[st.paidByUserId].owed = Math.max(0, balances[st.paidByUserId].owed - st.amount);
      }
    }

    const members = await Promise.all(
      Object.keys(balances).map((id) => db.user.findUnique({ where: { id } }))
    );

    const list = Object.keys(balances).map((uid) => {
      const m = members.find((u) => u && u.id === uid);
      const { owed, owing } = balances[uid];
      return {
        userId: uid,
        _id: uid,
        name: m?.name || "Unknown",
        imageUrl: m?.imageUrl || null,
        youAreOwed: owed,
        youOwe: owing,
        netBalance: owed - owing,
      };
    });

    return {
      type: "group",
      group: {
        id: group.id,
        _id: group.id,
        name: group.name,
        description: group.description,
      },
      balances: list,
    };
  }

  throw new Error("Invalid entityType; expected 'user' or 'group'");
}
