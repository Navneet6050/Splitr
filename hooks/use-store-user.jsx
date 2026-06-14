import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useMutation } from "./use-convex-query";
import { api } from "../convex/_generated/api";

export function useStoreUser() {
  const { isLoaded, isSignedIn, user } = useUser();
  // When this state is set we know the server
  // has stored the user in PostgreSQL.
  const [userId, setUserId] = useState(null);
  const storeUser = useMutation(api.users.store);

  // Call the `storeUser` mutation function to store
  // the current user in the `users` table and return the `Id` value.
  useEffect(() => {
    // If the user is not logged in don't do anything
    if (!isLoaded || !isSignedIn) {
      return;
    }
    // Store the user in the PostgreSQL database.
    async function createUser() {
      try {
        const id = await storeUser();
        setUserId(id);
      } catch (err) {
        console.error("Error storing user:", err);
      }
    }
    createUser();
    return () => setUserId(null);
  }, [isLoaded, isSignedIn, storeUser, user?.id]);

  // Combine the local state with the state from Clerk
  return {
    isLoading: !isLoaded || (isSignedIn && userId === null),
    isAuthenticated: isSignedIn && userId !== null,
  };
}
