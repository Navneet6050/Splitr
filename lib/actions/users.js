import { auth, currentUser as getClerkUser } from "@clerk/nextjs/server";
import { db } from "../db";

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const tokenIdentifier = `${process.env.CLERK_JWT_ISSUER_DOMAIN || "https://apt-collie-21.clerk.accounts.dev"}|${userId}`;

  let user = await db.user.findUnique({
    where: { tokenIdentifier },
  });

  if (!user) {
    const clerkUser = await getClerkUser();
    if (clerkUser) {
      const email = clerkUser.emailAddresses?.[0]?.emailAddress || null;
      const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "Anonymous";
      const imageUrl = clerkUser.imageUrl || null;

      user = await db.user.create({
        data: {
          tokenIdentifier,
          name,
          email,
          imageUrl,
        },
      });
    } else {
      throw new Error("User not found in database");
    }
  }

  // Format to match Convex _id property
  return {
    ...user,
    _id: user.id,
  };
}

export async function storeUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Called storeUser without authentication present");
  }

  const tokenIdentifier = `${process.env.CLERK_JWT_ISSUER_DOMAIN || "https://apt-collie-21.clerk.accounts.dev"}|${userId}`;
  const clerkUser = await getClerkUser();
  if (!clerkUser) {
    throw new Error("Clerk user not found");
  }

  const email = clerkUser.emailAddresses?.[0]?.emailAddress || null;
  const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "Anonymous";
  const imageUrl = clerkUser.imageUrl || null;

  let user = await db.user.findUnique({
    where: { tokenIdentifier },
  });

  if (user) {
    const patchData = {};
    if (name && user.name !== name) patchData.name = name;
    if (email && user.email !== email) patchData.email = email;
    if (imageUrl && user.imageUrl !== imageUrl) patchData.imageUrl = imageUrl;

    if (Object.keys(patchData).length > 0) {
      user = await db.user.update({
        where: { id: user.id },
        data: patchData,
      });
    }
  } else {
    user = await db.user.create({
      data: {
        tokenIdentifier,
        name,
        email,
        imageUrl,
      },
    });
  }

  return user.id;
}

export async function searchUsers({ query }) {
  const user = await getCurrentUser();
  if (query.length < 2) return [];

  const results = await db.user.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
      NOT: { id: user.id },
    },
  });

  return results.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    imageUrl: u.imageUrl,
  }));
}
