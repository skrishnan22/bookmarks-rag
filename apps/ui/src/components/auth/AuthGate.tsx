import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useAuth } from "./AuthProvider";
import { Button } from "~/components/ui/button";

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, user, error, retryAuth } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        <span className="text-xs font-mono uppercase tracking-widest">
          Loading session
        </span>
      </div>
    );
  }

  if (error && !user) {
    return <AuthErrorScreen message={error} onRetry={retryAuth} />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

function AuthErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-4 text-center">
        <p className="text-sm font-medium text-zinc-600">{message}</p>
        <Button
          className="w-full"
          onClick={() => {
            void onRetry();
          }}
        >
          Retry
        </Button>
      </div>
    </div>
  );
}

function LoginScreen() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full space-y-6 text-center"
      >
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">
            Welcome back
          </h1>
          <p className="text-base font-medium text-zinc-500">
            Sign in to access your archive and keep your knowledge protected.
          </p>
        </div>
        <Button
          className="w-full"
          onClick={() => {
            void signInWithGoogle();
          }}
        >
          Sign in with Google
        </Button>
      </motion.div>
    </div>
  );
}
