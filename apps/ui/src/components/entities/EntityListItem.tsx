import { useState } from "react";
import {
  Book,
  Film,
  Tv,
  Loader2,
  ArrowUpRight,
  MoreHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type {
  Entity,
  EntityType,
  BookMetadata,
  MovieMetadata,
  TvShowMetadata,
} from "~/lib/api";

interface EntityListItemProps {
  entity: Entity;
  onClick?: () => void;
  index?: number;
}

const TYPE_CONFIG: Record<EntityType, { icon: typeof Book; label: string }> = {
  book: { icon: Book, label: "Book" },
  movie: { icon: Film, label: "Movie" },
  tv_show: { icon: Tv, label: "TV Show" },
};

function getEntityTitle(entity: Entity): string {
  if (!entity.metadata) return entity.name;
  return (entity.metadata as BookMetadata).canonical_title || entity.name;
}

function getEntitySubtitle(entity: Entity): string | null {
  if (!entity.metadata) return null;

  if (entity.type === "book") {
    const meta = entity.metadata as BookMetadata;
    const parts: string[] = [];
    if (meta.authors?.length) parts.push(meta.authors[0]);
    if (meta.year) parts.push(meta.year.toString());
    return parts.join(" · ");
  }

  if (entity.type === "movie") {
    const meta = entity.metadata as MovieMetadata;
    const parts: string[] = [];
    if (meta.year) parts.push(meta.year.toString());
    if (meta.directors?.length) parts.push(meta.directors[0]);
    return parts.join(" · ");
  }

  if (entity.type === "tv_show") {
    const meta = entity.metadata as TvShowMetadata;
    const parts: string[] = [];
    if (meta.first_air_year) parts.push(meta.first_air_year.toString());
    if (meta.seasons) parts.push(`${meta.seasons} Seasons`);
    return parts.join(" · ");
  }

  return null;
}

function getCoverUrl(entity: Entity): string | null {
  if (!entity.metadata) return null;
  if (entity.type === "book") {
    return (entity.metadata as BookMetadata).cover_url || null;
  }
  return (entity.metadata as MovieMetadata | TvShowMetadata).poster_url || null;
}

export function EntityListItem({
  entity,
  onClick,
  index = 0,
}: EntityListItemProps) {
  const [imageError, setImageError] = useState(false);
  const config = TYPE_CONFIG[entity.type];
  const Icon = config.icon;
  const coverUrl = getCoverUrl(entity);
  const title = getEntityTitle(entity);
  const subtitle = getEntitySubtitle(entity);
  const isPending = entity.status === "pending";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "group relative flex items-center gap-4 rounded-xl border border-transparent p-2 transition-all",
        "hover:bg-zinc-50 hover:border-zinc-200 cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Poster Thumbnail */}
      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 shadow-sm">
        {coverUrl && !imageError ? (
          <img
            src={coverUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Icon className="h-6 w-6" />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-serif text-sm font-bold text-zinc-900 leading-tight truncate group-hover:text-amber-900 transition-colors">
              {title}
            </h3>
            {subtitle && (
              <span className="text-xs text-zinc-400 font-medium truncate shrink-0">
                · {subtitle}
              </span>
            )}
          </div>

          <Badge
            variant="outline"
            className="hidden sm:inline-flex shrink-0 h-5 px-1.5 text-[10px] font-mono font-semibold uppercase text-zinc-400 border-zinc-200"
          >
            {config.label}
          </Badge>
        </div>

        {/* Snippet / Context */}
        <p className="line-clamp-1 text-xs text-zinc-400 font-sans font-medium leading-relaxed group-hover:text-zinc-500 transition-colors">
          {entity.bookmarkCount} bookmark{entity.bookmarkCount !== 1 ? "s" : ""}{" "}
          reference this.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-400 hover:text-amber-700 hover:bg-amber-50"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
