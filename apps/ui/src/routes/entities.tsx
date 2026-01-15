import { createFileRoute, Outlet } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { EntityTypeTab } from "~/components/entities/EntityTypeTab";

export const Route = createFileRoute("/entities")({
  component: EntitiesLayout,
});

function EntitiesLayout() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative pt-16 pb-8 px-4">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 font-sans">
              Your <span className="text-zinc-400">Collections</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 text-lg text-zinc-500 max-w-2xl font-medium"
          >
            Books, movies, and TV shows extracted from your bookmarks
          </motion.p>

          <div className="mt-8">
            <EntityTypeTab />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
