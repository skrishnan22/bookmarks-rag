import { useState } from "react";
import { ExternalLink, ImageIcon } from "lucide-react";
import { cn } from "~/lib/utils";

const THUMBNAIL_COLORS = [
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-cyan-500",
];

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
}

export function BookmarkListItem({ bookmark, onClick }: BookmarkListItemProps) {
  const [faviconError, setFaviconError] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hostname = new URL(bookmark.url).hostname.replace(/^www\./, "");

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) return;

    e.preventDefault();
    if (onClick) {
      onClick();
    } else {
      window.open(bookmark.url, "_blank", "noopener,noreferrer");
    }
  };

  const getThumbnailColor = (id: string) => {
    const sum = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return THUMBNAIL_COLORS[sum % THUMBNAIL_COLORS.length];
  };

  return (
    <a
      href={bookmark.url}
      onClick={handleClick}
      className={cn(
        "group flex w-full items-start gap-5 rounded-xl border border-transparent px-5 py-4 transition-all hover:bg-zinc-800/30",
        "focus:outline-none focus:bg-zinc-800/30",
        "hover:border-zinc-800/50 hover:shadow-sm"
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900 shadow-inner ring-1 ring-white/5">
        {!bookmark.ogImage || imageError ? (
          !bookmark.favicon || faviconError ? (
            <div className="flex h-full w-full items-center justify-center text-zinc-700 bg-zinc-900">
              <ImageIcon className="h-6 w-6" />
            </div>
          ) : (
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-zinc-900">
              <div
                className={cn(
                  "absolute inset-0 opacity-20",
                  getThumbnailColor(bookmark.id)
                )}
              />
              <img
                src={bookmark.favicon}
                alt=""
                className="relative h-6 w-6 object-contain opacity-90 transition-opacity group-hover:opacity-100"
                onError={() => setFaviconError(true)}
              />
            </div>
          )
        ) : (
          <img
            src={bookmark.ogImage}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col gap-1 pt-0.5">
        <div className="flex items-center gap-3">
          <h3 className="truncate text-base font-bold text-zinc-100 transition-colors group-hover:text-zinc-50">
            {bookmark.title || hostname}
          </h3>
          <span
            className={cn(
              "hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border border-transparent",
              "text-zinc-500 bg-zinc-800/50",
              "group-hover:text-zinc-900",
              getThumbnailColor(bookmark.id).replace("bg-", "group-hover:bg-").replace("500", "400")
            )}
          >
            {hostname}
          </span>
        </div>
        <p className="line-clamp-2 text-sm leading-relaxed text-zinc-400 group-hover:text-zinc-300">
          {bookmark.description || "No description"}
        </p>
      </div>

      <div className="hidden shrink-0 items-center justify-center h-full sm:flex pt-2">
        <ExternalLink className="h-4 w-4 text-zinc-600 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-amber-400" />
      </div>
    </a>
  );
}
