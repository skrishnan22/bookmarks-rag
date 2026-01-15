import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Film } from "lucide-react";
import { motion } from "framer-motion";
import { EntityListItem } from "~/components/entities/EntityListItem";
import { EntityBookmarksModal } from "~/components/entities/EntityBookmarksModal";
import { useEntities } from "~/hooks/useEntities";
import type { Entity } from "~/lib/api";

export const Route = createFileRoute("/entities/movies")({
  component: MoviesPage,
});

function MoviesPage() {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const { data, isLoading } = useEntities("movie");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-zinc-300"
              animate={{
                y: [0, -6, 0],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.entities.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{
            duration: 0.5,
            delay: 0.1,
            type: "spring",
            stiffness: 200,
          }}
          className="relative mb-6"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white border border-zinc-50 shadow-soft">
            <Film className="h-8 w-8 text-zinc-300" />
          </div>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-2 -top-2 h-3 w-3 rounded-full bg-zinc-200"
          />
        </motion.div>
        <h3 className="text-lg font-bold text-zinc-900">No movies found</h3>
        <p className="mt-1 text-sm text-zinc-500 font-medium">
          Movies mentioned in your bookmarks will appear here
        </p>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        className="flex flex-col space-y-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {data.entities.map((entity, index) => (
          <EntityListItem
            key={entity.id}
            entity={entity}
            index={index}
            onClick={() => setSelectedEntity(entity)}
          />
        ))}
      </motion.div>

      <EntityBookmarksModal
        entity={selectedEntity}
        isOpen={!!selectedEntity}
        onClose={() => setSelectedEntity(null)}
      />
    </>
  );
}
