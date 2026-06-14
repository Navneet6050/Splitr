"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useUser, SignedIn, SignedOut } from "@clerk/nextjs";

// Exporting Authenticated and Unauthenticated wrappers as equivalents to Convex Client
export const Authenticated = SignedIn;
export const Unauthenticated = SignedOut;

// Dynamic bridge to execute server actions
export const useConvexQuery = (queryRef, args) => {
  const [data, setData] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isLoaded, isSignedIn } = useUser();

  // Construct standard query name string
  const queryName = typeof queryRef === "string" ? queryRef : queryRef?._path || String(queryRef);

  useEffect(() => {
    if (!isLoaded) return;
    if (queryRef === "skip" || args === "skip") {
      setIsLoading(false);
      setData(undefined);
      return;
    }

    let isMounted = true;
    async function fetchData() {
      setIsLoading(true);
      try {
        const { executeQuery } = await import("@/lib/api-bridge");
        const res = await executeQuery(queryName, args);
        if (isMounted) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
          toast.error(err.message || "Failed to fetch data");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [isLoaded, isSignedIn, queryName, JSON.stringify(args)]);

  return { data, isLoading, error };
};

export const useConvexMutation = (mutationRef) => {
  const [data, setData] = useState(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutationName = typeof mutationRef === "string" ? mutationRef : mutationRef?._path || String(mutationRef);

  const mutate = useCallback(async (args) => {
    setIsLoading(true);
    setError(null);

    try {
      const { executeMutation } = await import("@/lib/api-bridge");
      const response = await executeMutation(mutationName, args);
      setData(response);
      return response;
    } catch (err) {
      setError(err);
      toast.error(err.message || "Mutation failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [mutationName]);

  return { mutate, data, isLoading, error };
};

// Aliases for useQuery/useMutation used directly in some files
export const useQuery = (queryRef, args) => {
  const { data } = useConvexQuery(queryRef, args);
  return data;
};

export const useMutation = (mutationRef) => {
  const { mutate } = useConvexMutation(mutationRef);
  return mutate;
};
