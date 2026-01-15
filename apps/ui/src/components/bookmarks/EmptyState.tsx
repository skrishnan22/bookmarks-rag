import { motion } from "framer-motion";
import { Bookmark, Search } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  const isSearchEmpty = title.toLowerCase().includes("no results");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex min-h-[300px] w-full flex-col items-center justify-center p-8 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-200 mb-6">
        {isSearchEmpty ? (
          <Search className="h-7 w-7 text-zinc-400" />
        ) : (
          <Bookmark className="h-7 w-7 text-zinc-400" />
        )}
      </div>

      <h3 className="mb-2 text-lg font-semibold text-zinc-900">{title}</h3>

      <p className="max-w-sm text-sm text-zinc-500 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
