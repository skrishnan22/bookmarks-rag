import { Link, useLocation } from "@tanstack/react-router";
import { Book, Film, Tv } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

const TABS = [
  {
    path: "/entities/books",
    label: "Books",
    icon: Book,
    color: "sage" as const,
  },
  {
    path: "/entities/movies",
    label: "Movies",
    icon: Film,
    color: "rose" as const,
  },
  {
    path: "/entities/tv-shows",
    label: "TV Shows",
    icon: Tv,
    color: "indigo" as const,
  },
] as const;

export function EntityTypeTab() {
  const location = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="inline-flex items-center gap-1 rounded-full bg-white p-1.5 shadow-medium border border-white/20 ring-1 ring-black/5"
    >
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
              isActive
                ? "text-ink-900 bg-canvas-100 shadow-sm ring-1 ring-black/5"
                : "text-ink-400 hover:text-ink-600 hover:bg-canvas-50/50"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="entity-tab-pill"
                className="absolute inset-0 bg-white rounded-full shadow-sm ring-1 ring-black/5"
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{ zIndex: -1 }}
              />
            )}
            <span
              className={cn(
                "relative z-10",
                isActive ? "text-ink-900" : "text-ink-500"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span
              className={cn(
                "relative z-10",
                isActive ? "text-ink-900" : "text-ink-500"
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </motion.div>
  );
}
