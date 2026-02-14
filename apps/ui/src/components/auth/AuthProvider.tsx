import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentUser, logout, type AuthUser } from "~/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  retryAuth: () => Promise<void>;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_BOOTSTRAP_ERROR = "We couldn't verify your session. Please retry.";
const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isFetching,
    error: authError,
    refetch,
  } = useQuery<AuthUser | null, Error>({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: fetchCurrentUser,
    retry: false,
  });

  const clearAppQueries = useCallback(async () => {
    await queryClient.cancelQueries({
      predicate: (query) => query.queryKey[0] !== "auth",
    });
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "auth",
    });
  }, [queryClient]);

  const retryAuth = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const signInWithGoogle = useCallback(() => {
    window.location.href = "/api/v1/auth/login/google";
  }, []);

  const signOut = useCallback(async () => {
    queryClient.setQueryData<AuthUser | null>(AUTH_ME_QUERY_KEY, null);
    await clearAppQueries();

    try {
      await logout();
    } catch (requestError) {
      console.error("Failed to clear backend session", requestError);
    }

    await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
  }, [clearAppQueries, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      loading: isLoading || (isFetching && !user && !authError),
      error: !user && authError ? AUTH_BOOTSTRAP_ERROR : null,
      retryAuth,
      signInWithGoogle,
      signOut,
    }),
    [
      authError,
      isFetching,
      isLoading,
      retryAuth,
      signInWithGoogle,
      signOut,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
