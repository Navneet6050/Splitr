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

export async function listForGroup({ groupId }) {
  const user = await getCurrentUser();
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("Group not found");

  const results = await db.groupMembership.findMany({
    where: { groupId },
    orderBy: { joinedAt: "asc" },
  });

  return results.map((m) => ({
    ...mapDoc(m),
    joinedAt: m.joinedAt.getTime(),
    leftAt: m.leftAt ? m.leftAt.getTime() : null,
  }));
}

export async function upsert(args) {
  const user = await getCurrentUser();
  const group = await db.group.findUnique({ where: { id: args.groupId } });
  if (!group) throw new Error("Group not found");

  const joinedAtDate = new Date(args.joinedAt);
  const leftAtDate = args.leftAt ? new Date(args.leftAt) : null;

  const membership = await db.$transaction(async (tx) => {
    const newMembership = await tx.groupMembership.create({
      data: {
        groupId: args.groupId,
        userId: args.userId,
        role: args.role,
        joinedAt: joinedAtDate,
        leftAt: leftAtDate,
        source: args.source || "manual",
        createdByUserId: user.id,
      },
    });

    // Sync group JSON field
    let members = Array.isArray(group.members) ? group.members : [];
    members = members.filter((m) => m.userId !== args.userId);
    members.push({
      userId: args.userId,
      role: args.role,
      joinedAt: args.joinedAt,
    });

    await tx.group.update({
      where: { id: args.groupId },
      data: { members },
    });

    return newMembership;
  });

  return { membershipId: membership.id };
}
