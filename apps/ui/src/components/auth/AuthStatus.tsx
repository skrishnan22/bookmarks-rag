import { useAuth } from "./AuthProvider";
import { Button } from "~/components/ui/button";

export function AuthStatus() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  const label =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : (user.email ?? "Signed in");

  return (
    <div className="flex items-center gap-2 pl-3 border-l border-white/40">
      <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void signOut();
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
