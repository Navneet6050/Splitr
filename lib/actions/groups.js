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

export async function getGroupOrMembers({ groupId } = {}) {
  const currentUser = await getCurrentUser();

  // Find all groups where the user is a member (either via GroupMembership table or json members)
  const memberships = await db.groupMembership.findMany({
    where: { userId: currentUser.id },
    select: { groupId: true },
  });
  const memberGroupIds = memberships.map((m) => m.groupId);

  // Fallback: search groups created by user or having them in JSON
  const allGroups = await db.group.findMany({
    where: {
      OR: [
        { id: { in: memberGroupIds } },
        { createdByUserId: currentUser.id },
      ],
    },
    include: {
      memberships: {
        include: {
          user: true,
        },
      },
    },
  });

  const userGroups = allGroups.map((group) => {
    // If members JSON is an array, use it, otherwise use memberships relation
    let membersArray = Array.isArray(group.members) ? group.members : [];
    if (membersArray.length === 0 && group.memberships) {
      membersArray = group.memberships.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.getTime(),
      }));
    }
    return {
      ...mapDoc(group),
      members: membersArray,
    };
  });

  if (groupId) {
    const selectedGroupRaw = userGroups.find((g) => g.id === groupId);
    if (!selectedGroupRaw) {
      throw new Error("Group not found or you're not a member");
    }

    // Load full details for group members
    const memberDetails = await Promise.all(
      selectedGroupRaw.members.map(async (m) => {
        const u = await db.user.findUnique({ where: { id: m.userId } });
        if (!u) return null;
        return {
          id: u.id,
          _id: u.id,
          name: u.name,
          email: u.email,
          imageUrl: u.imageUrl,
          role: m.role,
        };
      })
    );

    const validMembers = memberDetails.filter(Boolean);

    return {
      selectedGroup: {
        id: selectedGroupRaw.id,
        _id: selectedGroupRaw.id,
        name: selectedGroupRaw.name,
        description: selectedGroupRaw.description,
        createdBy: selectedGroupRaw.createdByUserId,
        members: validMembers,
      },
      groups: userGroups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        memberCount: g.members.length,
      })),
    };
  }

  return {
    selectedGroup: null,
    groups: userGroups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: g.members.length,
    })),
  };
}

export async function getGroupExpenses({ groupId }) {
  const currentUser = await getCurrentUser();

  const group = await db.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!group) throw new Error("Group not found");

  // Load members array
  let membersArray = Array.isArray(group.members) ? group.members : [];
  if (membersArray.length === 0 && group.memberships) {
    membersArray = group.memberships.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.getTime(),
    }));
  }

  if (!membersArray.some((m) => m.userId === currentUser.id)) {
    throw new Error("You are not a member of this group");
  }

  // Load expenses and settlements
  const expensesRaw = await db.expense.findMany({
    where: { groupId },
    orderBy: { date: "desc" },
  });

  const settlementsRaw = await db.settlement.findMany({
    where: { groupId },
    orderBy: { date: "desc" },
  });

  const expenses = expensesRaw.map((e) => ({
    ...mapDoc(e),
    date: e.date.getTime(),
    splits: Array.isArray(e.splits) ? e.splits : [],
  }));

  const settlements = settlementsRaw.map((s) => ({
    ...mapDoc(s),
    date: s.date.getTime(),
  }));

  // Fetch full details of members
  const memberDetails = await Promise.all(
    membersArray.map(async (m) => {
      const u = await db.user.findUnique({ where: { id: m.userId } });
      return {
        id: u?.id || m.userId,
        _id: u?.id || m.userId,
        name: u?.name || "Unknown",
        imageUrl: u?.imageUrl || null,
        role: m.role,
      };
    })
  );

  const ids = memberDetails.map((m) => m.id);

  // Ledgers
  const totals = Object.fromEntries(ids.map((id) => [id, 0]));
  const ledger = {};
  ids.forEach((a) => {
    ledger[a] = {};
    ids.forEach((b) => {
      if (a !== b) ledger[a][b] = 0;
    });
  });

  // Apply expenses
  for (const exp of expenses) {
    const payer = exp.paidByUserId;
    if (!ids.includes(payer)) continue;
    for (const split of exp.splits) {
      const debtor = split.userId;
      if (!ids.includes(debtor)) continue;
      if (debtor === payer || split.paid) continue;

      totals[payer] += split.amount;
      totals[debtor] -= split.amount;
      ledger[debtor][payer] += split.amount;
    }
  }

  // Apply settlements
  for (const s of settlements) {
    if (!ids.includes(s.paidByUserId) || !ids.includes(s.receivedByUserId)) continue;
    totals[s.paidByUserId] += s.amount;
    totals[s.receivedByUserId] -= s.amount;
    ledger[s.paidByUserId][s.receivedByUserId] -= s.amount;
  }

  // Net pairwise ledger
  ids.forEach((a) => {
    ids.forEach((b) => {
      if (a >= b) return;
      const diff = ledger[a][b] - ledger[b][a];
      if (diff > 0) {
        ledger[a][b] = diff;
        ledger[b][a] = 0;
      } else if (diff < 0) {
        ledger[b][a] = -diff;
        ledger[a][b] = 0;
      } else {
        ledger[a][b] = ledger[b][a] = 0;
      }
    });
  });

  // Shape balances
  const balances = memberDetails.map((m) => ({
    ...m,
    totalBalance: totals[m.id] || 0,
    owes: Object.entries(ledger[m.id] || {})
      .filter(([, v]) => v > 0)
      .map(([to, amount]) => ({ to, amount })),
    owedBy: ids
      .filter((other) => (ledger[other]?.[m.id] || 0) > 0)
      .map((other) => ({ from: other, amount: ledger[other][m.id] })),
  }));

  const userLookupMap = {};
  memberDetails.forEach((m) => {
    userLookupMap[m.id] = m;
  });

  return {
    group: {
      id: group.id,
      _id: group.id,
      name: group.name,
      description: group.description,
    },
    members: memberDetails,
    expenses,
    settlements,
    balances,
    userLookupMap,
  };
}
