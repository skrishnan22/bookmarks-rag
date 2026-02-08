import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const syncSession = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.access_token) {
      return;
    }

    const response = await fetch("/api/v1/auth/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: nextSession.access_token }),
    });

    if (!response.ok) {
      console.error("Failed to sync session", await response.text());
    }
  }, []);

  const clearSession = useCallback(async () => {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Failed to load session", error);
        }
        setSession(data.session ?? null);
        if (data.session) {
          setSyncing(true);
          try {
            await syncSession(data.session);
          } finally {
            setSyncing(false);
          }
        }
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load session", error);
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        setSession(nextSession);
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          setSyncing(true);
          try {
            await syncSession(nextSession);
          } finally {
            setSyncing(false);
          }
        }
        if (event === "SIGNED_OUT") {
          await clearSession();
        }
      }
    );

    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
    };
  }, [clearSession, syncSession]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      console.error("Google sign-in failed", error);
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out failed", error);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading: loading || syncing,
      signInWithGoogle,
      signOut,
    }),
    [loading, session, signInWithGoogle, signOut]
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
