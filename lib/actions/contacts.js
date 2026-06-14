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

export async function getAllContacts() {
  const currentUser = await getCurrentUser();

  // Find 1-to-1 expenses paid by user or where user is in splits
  const allOneOnOneExpenses = await db.expense.findMany({
    where: { groupId: null },
  });

  const personalExpenses = allOneOnOneExpenses.filter((e) => {
    const splits = Array.isArray(e.splits) ? e.splits : [];
    return e.paidByUserId === currentUser.id || splits.some((s) => s.userId === currentUser.id);
  });

  const contactIds = new Set();
  personalExpenses.forEach((exp) => {
    if (exp.paidByUserId !== currentUser.id) {
      contactIds.add(exp.paidByUserId);
    }
    const splits = Array.isArray(exp.splits) ? exp.splits : [];
    splits.forEach((s) => {
      if (s.userId !== currentUser.id) {
        contactIds.add(s.userId);
      }
    });
  });

  const contactUsers = await Promise.all(
    [...contactIds].map(async (id) => {
      const u = await db.user.findUnique({ where: { id } });
      return u
        ? {
            id: u.id,
            _id: u.id,
            name: u.name,
            email: u.email,
            imageUrl: u.imageUrl,
            type: "user",
          }
        : null;
    })
  );

  // Groups where user is member
  const memberships = await db.groupMembership.findMany({
    where: { userId: currentUser.id },
    select: { groupId: true },
  });
  const memberGroupIds = memberships.map((m) => m.groupId);

  const groups = await db.group.findMany({
    where: {
      OR: [
        { id: { in: memberGroupIds } },
        { createdByUserId: currentUser.id },
      ],
    },
  });

  const userGroups = groups.map((g) => {
    const membersArray = Array.isArray(g.members) ? g.members : [];
    return {
      id: g.id,
      _id: g.id,
      name: g.name,
      description: g.description,
      memberCount: membersArray.length,
      type: "group",
    };
  });

  const filteredContacts = contactUsers.filter(Boolean);
  filteredContacts.sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
  userGroups.sort((a, b) => a.name.localeCompare(b.name));

  return {
    users: filteredContacts,
    groups: userGroups,
  };
}

export async function createGroup(args) {
  const currentUser = await getCurrentUser();

  if (!args.name.trim()) throw new Error("Group name cannot be empty");

  const uniqueMembers = new Set(args.members || []);
  uniqueMembers.add(currentUser.id);

  // Validate user IDs exist
  for (const id of uniqueMembers) {
    const exists = await db.user.findUnique({ where: { id } });
    if (!exists) throw new Error(`User with ID ${id} not found`);
  }

  const membersArray = [...uniqueMembers].map((id) => ({
    userId: id,
    role: id === currentUser.id ? "admin" : "member",
    joinedAt: Date.now(),
  }));

  const result = await db.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        name: args.name.trim(),
        description: args.description?.trim() ?? "",
        createdByUserId: currentUser.id,
        members: membersArray, // JSON array
      },
    });

    // Create normalized GroupMembership rows
    await Promise.all(
      membersArray.map((m) =>
        tx.groupMembership.create({
          data: {
            groupId: group.id,
            userId: m.userId,
            role: m.role,
            joinedAt: new Date(m.joinedAt),
            source: "manual",
            createdByUserId: currentUser.id,
          },
        })
      )
    );

    return group;
  }, {
    timeout: 15000
  });

  return result.id;
}
