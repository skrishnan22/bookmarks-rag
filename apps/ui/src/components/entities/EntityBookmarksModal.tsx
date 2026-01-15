import { useEffect, useRef } from "react";
import { X, ExternalLink, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { useEntityBookmarks } from "~/hooks/useEntities";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { Entity } from "~/lib/api";

interface EntityBookmarksModalProps {
  entity: Entity | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EntityBookmarksModal({
  entity,
  isOpen,
  onClose,
}: EntityBookmarksModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useEntityBookmarks(
    entity?.id ?? null,
    isOpen && !!entity
  );

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!entity) return null;

  const title = (entity.metadata as any)?.canonical_title || entity.name;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl",
              "bg-white shadow-2xl border border-zinc-200"
            )}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/95 px-6 py-4 backdrop-blur-sm">
              <div className="min-w-0">
                <h2 className="truncate font-sans font-semibold text-lg text-zinc-900">
                  {title}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="secondary"
                    className="font-mono text-[10px] uppercase"
                  >
                    {data?.total ?? 0} bookmark{data?.total !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full text-zinc-400 hover:text-zinc-900"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div
              className="overflow-y-auto p-6"
              style={{ maxHeight: "calc(80vh - 80px)" }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-zinc-300"
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : data?.bookmarks.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  No bookmarks found
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {data?.bookmarks.map((bookmark, index) => (
                    <motion.a
                      key={bookmark.id}
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "group flex items-start gap-4 rounded-xl p-4 transition-all",
                        "bg-zinc-50/50 hover:bg-white border border-transparent hover:border-zinc-200 hover:shadow-sm"
                      )}
                    >
                      {bookmark.ogImage && (
                        <img
                          src={bookmark.ogImage}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-sm border border-zinc-200"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium text-sm text-zinc-900 group-hover:text-black transition-colors">
                            {bookmark.title || new URL(bookmark.url).hostname}
                          </h3>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        {bookmark.contextSnippet ? (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-500 font-sans leading-relaxed">
                            ...{bookmark.contextSnippet}...
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-zinc-400 font-mono truncate">
                            {new URL(bookmark.url).hostname}
                          </p>
                        )}
                      </div>
                    </motion.a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
