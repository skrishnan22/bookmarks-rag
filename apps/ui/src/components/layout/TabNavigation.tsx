import { Link, useLocation } from "@tanstack/react-router";
import { BookMarked, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { AuthStatus } from "~/components/auth/AuthStatus";

export function TabNavigation() {
  const location = useLocation();
  const isEntitiesActive = location.pathname.startsWith("/entities");

  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center p-1 rounded-full bg-white/60 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.04)] ring-1 ring-zinc-900/5"
      >
        <div className="flex items-center gap-1 p-0.5">
          <NavLink
            to="/"
            active={!isEntitiesActive}
            icon={<BookMarked className="h-4 w-4" />}
            label="Bookmarks"
          />
          <NavLink
            to="/entities/books"
            active={isEntitiesActive}
            icon={<Layers className="h-4 w-4" />}
            label="Collections"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      >
        <AuthStatus />
      </motion.div>
    </div>
  );
}

interface NavLinkProps {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}

function NavLink({ to, active, icon, label }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
        active
          ? "text-white"
          : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50"
      )}
    >
      {active && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 bg-zinc-900 rounded-full shadow-sm"
          initial={false}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          style={{ zIndex: -1 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        {label}
      </span>
    </Link>
  );
}
