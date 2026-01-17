import { useState } from "react";
import { Book, Film, Tv, Loader2, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type {
  Entity,
  EntityType,
  BookMetadata,
  MovieMetadata,
  TvShowMetadata,
} from "~/lib/api";

interface EntityCardProps {
  entity: Entity;
  onClick?: () => void;
  index?: number;
}

const TYPE_ICONS: Record<EntityType, typeof Book> = {
  book: Book,
  movie: Film,
  tv_show: Tv,
};

function getEntityTitle(entity: Entity): string {
  if (!entity.metadata) return entity.name;
  return (entity.metadata as BookMetadata).canonical_title || entity.name;
}

function getCoverUrl(entity: Entity): string | null {
  if (!entity.metadata) return null;
  if (entity.type === "book") {
    return (entity.metadata as BookMetadata).cover_url || null;
  }
  return (entity.metadata as MovieMetadata | TvShowMetadata).poster_url || null;
}

export function EntityCard({ entity, onClick, index = 0 }: EntityCardProps) {
  const [imageError, setImageError] = useState(false);
  const Icon = TYPE_ICONS[entity.type];
  const coverUrl = getCoverUrl(entity);
  const title = getEntityTitle(entity);
  const isPending = entity.status === "PENDING";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-300",
          "hover:shadow-lift hover:border-zinc-300 cursor-pointer border-zinc-200 bg-white"
        )}
        onClick={onClick}
      >
        {/* Poster Image Area - Architectural Aspect Ratio */}
        <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-100 relative">
          {coverUrl && !imageError ? (
            <img
              src={coverUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              {isPending ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <Icon className="h-10 w-10" />
              )}
            </div>
          )}

          {/* Glass Overlay on Hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0">
            <Button
              size="sm"
              variant="secondary"
              className="w-full bg-white/90 backdrop-blur-md text-zinc-900 hover:bg-white shadow-lg border-0"
            >
              View Details <ArrowUpRight className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="p-3 border-t border-zinc-100 bg-white">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-medium text-sm text-zinc-900 line-clamp-1 leading-snug"
              title={title}
            >
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] font-mono uppercase text-zinc-500 border-zinc-200"
            >
              {entity.type.replace("_", " ")}
            </Badge>
            {isPending && (
              <span className="text-[10px] text-zinc-400 font-medium animate-pulse">
                Processing...
              </span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
