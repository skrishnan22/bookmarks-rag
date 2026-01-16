import { useState } from "react";
import {
  ExternalLink,
  ImageIcon,
  MoreHorizontal,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useDeleteBookmark } from "~/hooks/useBookmarks";

interface BookmarkListItemProps {
  bookmark: {
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    favicon: string | null;
    ogImage: string | null;
  };
  onClick?: () => void;
  index?: number;
}

export function BookmarkListItem({
  bookmark,
  onClick,
  index = 0,
}: BookmarkListItemProps) {
  const [faviconError, setFaviconError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteBookmark = useDeleteBookmark();

  const hostname = new URL(bookmark.url).hostname.replace(/^www\./, "");

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || (e.target as HTMLElement).closest("button"))
      return;

    e.preventDefault();
    if (onClick) {
      onClick();
    } else {
      window.open(bookmark.url, "_blank", "noopener,noreferrer");
    }
  };

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
        "group relative flex items-center gap-4 rounded-lg border border-transparent p-3 transition-all",
        "hover:bg-zinc-50 hover:border-zinc-200"
      )}
      onClick={handleClick}
    >
      {/* Favicon / Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white border border-zinc-200 shadow-sm">
        {!bookmark.favicon || faviconError ? (
          <div className="flex h-full w-full items-center justify-center bg-zinc-50 rounded-md">
            <span className="text-xs font-mono font-medium text-zinc-500">
              {hostname.charAt(0).toUpperCase()}
            </span>
          </div>
        ) : (
          <img
            src={bookmark.favicon}
            alt=""
            className="h-5 w-5 object-contain"
            onError={() => setFaviconError(true)}
          />
        )}
      </div>

      {/* Main Content (Row Layout) */}
      <div className="flex flex-1 items-center gap-4 min-w-0">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-zinc-900 leading-tight">
            {bookmark.title || hostname}
          </h3>
          <p className="truncate text-xs text-zinc-500 font-medium">
            {bookmark.description || bookmark.url}
          </p>
        </div>

        {/* Metadata Pill */}
        <Badge
          variant="secondary"
          className="hidden sm:inline-flex shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200/60"
        >
          {hostname}
        </Badge>
      </div>

      {/* Actions (Visible on Hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-400 hover:text-amber-700 hover:bg-amber-50"
          onClick={(e) => {
            e.stopPropagation();
            window.open(bookmark.url, "_blank", "noopener,noreferrer");
          }}
        >
          <ArrowUpRight className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          deleteBookmark.mutate(bookmark.id, {
            onSuccess: () => setShowDeleteConfirm(false),
          });
        }}
        title="Delete bookmark"
        description="Are you sure you want to delete this bookmark? This will also remove all associated data. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteBookmark.isPending}
      />
    </motion.div>
  );
}
