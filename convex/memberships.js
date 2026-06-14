import { mutation, query } from "./_generated/server";
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

export const listForGroup = query({
    args: { groupId: v.id("groups") },
    handler: async (ctx, args) => {
        const user = await getCurrentUser(ctx);
        const group = await ctx.db.get(args.groupId);
        if (!group) throw new Error("Group not found");
        // return memberships for group
        return await ctx.db
            .query("memberships")
            .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
            .order("asc")
            .take(1000);
    },
});

export const upsert = mutation({
    args: {
        groupId: v.id("groups"),
        userId: v.id("users"),
        role: v.string(),
        joinedAt: v.number(),
        leftAt: v.optional(v.number()),
        source: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getCurrentUser(ctx);
        const group = await ctx.db.get(args.groupId);
        if (!group) throw new Error("Group not found");

        // Insert new membership row. For simplicity, always insert a new membership event.
        const membershipId = await ctx.db.insert("memberships", {
            groupId: args.groupId,
            userId: args.userId,
            role: args.role,
            joinedAt: args.joinedAt,
            leftAt: args.leftAt ?? null,
            source: args.source ?? "manual",
            createdBy: user._id,
        });
        return { membershipId };
    },
});

export default { listForGroup, upsert };
