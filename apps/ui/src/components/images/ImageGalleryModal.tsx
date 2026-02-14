import { useEffect, useRef, useState } from "react";
import {
  X,
  Image as ImageIcon,
  Sparkles,
  Ban,
  Check,
  Loader2,
  AlertCircle,
  Book,
  Film,
  Tv,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import {
  useBookmarkImages,
  useExtractImage,
  useExtractAllImages,
  useSkipImage,
} from "~/hooks/useBookmarkImages";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { ContentImage } from "~/lib/api";

interface ImageGalleryModalProps {
  bookmarkId: string | null;
  bookmarkTitle?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function getStatusBadgeProps(status: ContentImage["status"]) {
  switch (status) {
    case "PENDING":
      return { label: "Pending", className: "bg-zinc-100 text-zinc-600" };
    case "QUEUED":
      return { label: "Queued", className: "bg-blue-100 text-blue-700" };
    case "PROCESSING":
      return { label: "Processing", className: "bg-amber-100 text-amber-700" };
    case "COMPLETED":
      return { label: "Extracted", className: "bg-emerald-100 text-emerald-700" };
    case "SKIPPED":
      return { label: "Skipped", className: "bg-zinc-100 text-zinc-500" };
    case "FAILED":
      return { label: "Failed", className: "bg-red-100 text-red-700" };
    default:
      return { label: status, className: "bg-zinc-100 text-zinc-600" };
  }
}

function getScoreColor(score: number | null): string {
  if (score === null) return "bg-zinc-200";
  if (score >= 0.7) return "bg-emerald-500";
  if (score >= 0.5) return "bg-amber-500";
  if (score >= 0.3) return "bg-orange-400";
  return "bg-zinc-300";
}

function EntityTypeIcon({ type }: { type: "book" | "movie" | "tv_show" }) {
  switch (type) {
    case "book":
      return <Book className="h-3 w-3" />;
    case "movie":
      return <Film className="h-3 w-3" />;
    case "tv_show":
      return <Tv className="h-3 w-3" />;
  }
}

function ImageCard({
  image,
  bookmarkId,
}: {
  image: ContentImage;
  bookmarkId: string;
}) {
  const [imgError, setImgError] = useState(false);
  const extractImage = useExtractImage(bookmarkId);
  const skipImage = useSkipImage(bookmarkId);

  const statusBadge = getStatusBadgeProps(image.status);
  const isProcessing = image.status === "QUEUED" || image.status === "PROCESSING";
  const canExtract = image.status === "PENDING" || image.status === "FAILED";
  const canSkip = image.status === "PENDING" || image.status === "FAILED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
    >
      {/* Image Preview */}
      <div className="relative aspect-video bg-zinc-100">
        {imgError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-zinc-300" />
          </div>
        ) : (
          <img
            src={image.url}
            alt={image.altText || ""}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        )}

        {/* Score indicator */}
        {image.heuristicScore !== null && (
          <div
            className={cn(
              "absolute top-2 left-2 h-2 w-2 rounded-full shadow-sm",
              getScoreColor(image.heuristicScore)
            )}
            title={`Score: ${(image.heuristicScore * 100).toFixed(0)}%`}
          />
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Status and type */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="secondary"
            className={cn("text-[10px] font-medium", statusBadge.className)}
          >
            {statusBadge.label}
          </Badge>
          {image.estimatedType && (
            <span className="text-[10px] text-zinc-400 font-medium">
              {image.estimatedType}
            </span>
          )}
        </div>

        {/* Alt text */}
        {image.altText && (
          <p className="text-xs text-zinc-600 line-clamp-2">{image.altText}</p>
        )}

        {/* Score bar */}
        {image.heuristicScore !== null && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", getScoreColor(image.heuristicScore))}
                style={{ width: `${image.heuristicScore * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              {(image.heuristicScore * 100).toFixed(0)}%
            </span>
          </div>
        )}

        {/* Extracted entities */}
        {image.extractedEntities?.entities &&
          image.extractedEntities.entities.length > 0 && (
            <div className="pt-2 border-t border-zinc-100 space-y-1">
              {image.extractedEntities.entities.map((entity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-zinc-700"
                >
                  <EntityTypeIcon type={entity.type} />
                  <span className="font-medium truncate">{entity.name}</span>
                  <span className="text-zinc-400 ml-auto">
                    {(entity.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}

        {/* Error message */}
        {image.status === "FAILED" && image.errorMessage && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-md">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{image.errorMessage}</span>
          </div>
        )}

        {/* Actions */}
        {(canExtract || canSkip) && (
          <div className="flex items-center gap-2 pt-2">
            {canExtract && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs"
                onClick={() => extractImage.mutate(image.id)}
                disabled={extractImage.isPending}
              >
                {extractImage.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                Extract
              </Button>
            )}
            {canSkip && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-zinc-500"
                onClick={() => skipImage.mutate(image.id)}
                disabled={skipImage.isPending}
              >
                <Ban className="h-3 w-3 mr-1" />
                Skip
              </Button>
            )}
          </div>
        )}

        {/* Completed indicator */}
        {image.status === "COMPLETED" &&
          (!image.extractedEntities?.entities ||
            image.extractedEntities.entities.length === 0) && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 pt-2">
              <Check className="h-3.5 w-3.5" />
              <span>No entities found in image</span>
            </div>
          )}
      </div>
    </motion.div>
  );
}

export function ImageGalleryModal({
  bookmarkId,
  bookmarkTitle,
  isOpen,
  onClose,
}: ImageGalleryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useBookmarkImages(isOpen ? bookmarkId : null);
  const extractAll = useExtractAllImages(bookmarkId ?? "");

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

  const pendingCount = data?.images.filter((img) => img.status === "PENDING").length ?? 0;
  const highScoreCount =
    data?.images.filter(
      (img) =>
        img.status === "PENDING" &&
        img.heuristicScore !== null &&
        img.heuristicScore >= 0.5
    ).length ?? 0;

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
              "relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl",
              "bg-white shadow-2xl border border-zinc-200"
            )}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/95 px-6 py-4 backdrop-blur-sm">
              <div className="min-w-0">
                <h2 className="truncate font-sans font-semibold text-lg text-zinc-900">
                  Images
                </h2>
                {bookmarkTitle && (
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {bookmarkTitle}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant="secondary"
                    className="font-mono text-[10px] uppercase"
                  >
                    {data?.total ?? 0} image{data?.total !== 1 ? "s" : ""}
                  </Badge>
                  {pendingCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="font-mono text-[10px] uppercase bg-amber-50 text-amber-700"
                    >
                      {pendingCount} pending
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => extractAll.mutate(0.5)}
                    disabled={extractAll.isPending}
                  >
                    {extractAll.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1.5" />
                    )}
                    Extract Likely ({highScoreCount})
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full text-zinc-400 hover:text-zinc-900"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div
              className="overflow-y-auto p-6"
              style={{ maxHeight: "calc(85vh - 100px)" }}
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
              ) : !data || data.images.length === 0 ? (
                <div className="py-12 text-center">
                  <ImageIcon className="h-12 w-12 text-zinc-200 mx-auto mb-4" />
                  <p className="text-zinc-500">No images found in this bookmark</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Images are extracted when bookmarks are processed
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.images.map((image) => (
                    <ImageCard
                      key={image.id}
                      image={image}
                      bookmarkId={bookmarkId!}
                    />
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
