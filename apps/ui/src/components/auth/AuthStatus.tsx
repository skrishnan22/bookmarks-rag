import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button } from "~/components/ui/button";
import { LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AuthStatus() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name ?? user.email}
            className="w-6 h-6 rounded-full object-cover ring-1 ring-zinc-200"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-zinc-200">
            {initials}
          </div>
        )}
        <span className="text-xs font-medium text-zinc-700 hidden sm:block max-w-[120px] truncate">
          {user.name ?? user.email}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-zinc-900/5 z-50 overflow-hidden"
            >
              <div className="p-3 border-b border-zinc-100">
                <p className="text-sm font-semibold text-zinc-900 truncate">
                  {user.name ?? "User"}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
              <div className="p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/50"
                  onClick={() => {
                    void signOut();
                    setIsOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
