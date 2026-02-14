import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookmarkListItem } from "~/components/bookmarks/BookmarkListItem";
import { EmptyState } from "~/components/bookmarks/EmptyState";
import { LoadingState } from "~/components/bookmarks/LoadingState";
import { SearchBar } from "~/components/search/SearchBar";
import { useDebounce } from "~/hooks/useDebounce";
import {
  useBookmarks,
  useSearchBookmarks,
  flattenBookmarks,
  useCreateBookmark,
} from "~/hooks/useBookmarks";
import { Link2, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const isSearchMode = debouncedQuery.length >= 2;

  const {
    data: bookmarksData,
    isLoading: isLoadingBookmarks,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useBookmarks();

  const { data: searchResults, isLoading: isSearching } = useSearchBookmarks(
    debouncedQuery,
    isSearchMode
  );

  const bookmarks = flattenBookmarks(bookmarksData?.pages);

  const createBookmarkMutation = useCreateBookmark();

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim() || createBookmarkMutation.isPending) return;

    setAddError(null);
    setAddSuccess(false);

    try {
      const response = await createBookmarkMutation.mutateAsync(newUrl.trim());
      if (response.success) {
        setNewUrl("");
        setAddSuccess(true);
        setTimeout(() => setAddSuccess(false), 3000);
      } else {
        setAddError(response.error?.message || "Failed to add bookmark");
      }
    } catch (error) {
      setAddError("Failed to add bookmark. Please try again.");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchMode || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const current = loadMoreRef.current;
    if (current) observer.observe(current);
    return () => {
      if (current) observer.unobserve(current);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isSearchMode]);

  const displayItems = isSearchMode
    ? (searchResults ?? []).map((r) => ({
        id: r.bookmarkId,
        url: r.url,
        title: r.title,
        description: r.description ?? r.snippet,
        favicon: r.favicon ?? null,
        ogImage: r.ogImage ?? null,
      }))
    : bookmarks.map((b) => ({
        id: b.id,
        url: b.url,
        title: b.title,
        description: b.description,
        favicon: b.favicon,
        ogImage: b.ogImage,
      }));

  const isInitialLoading = isLoadingBookmarks && bookmarks.length === 0;
  const showEmptyState =
    !isInitialLoading && !isSearching && displayItems.length === 0;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative pt-16 pb-12 px-4">
        <div className="mx-auto max-w-2xl text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 font-sans">
              Your <span className="text-zinc-400">Archive</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-base font-medium text-zinc-500 max-w-md mx-auto"
          >
            A high-density collection of your resources and inspiration.
          </motion.p>

          <div className="max-w-xl mx-auto pt-4 space-y-4">
            <SearchBar
              ref={searchInputRef}
              value={query}
              onChange={setQuery}
              placeholder="Search through your collection..."
              loading={isSearching}
            />

            {/* Add Bookmark Input */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              onSubmit={handleAddBookmark}
              className="flex items-center gap-2"
            >
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  type="url"
                  placeholder="Paste a link to add..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="pl-10 bg-white/60 backdrop-blur-sm border-white/20 focus:bg-white/80"
                  disabled={createBookmarkMutation.isPending}
                />
              </div>
              <Button
                type="submit"
                disabled={createBookmarkMutation.isPending || !newUrl.trim()}
                className="shrink-0"
              >
                {createBookmarkMutation.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </motion.form>

            {/* Success/Error Messages */}
            {addSuccess && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-emerald-600 font-medium"
              >
                Bookmark added successfully!
              </motion.p>
            )}
            {addError && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-red-600 font-medium"
              >
                {addError}
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 pb-20">
        {isInitialLoading ? (
          <LoadingState message="Loading your bookmarks..." />
        ) : isSearching ? (
          <LoadingState message="Searching..." />
        ) : showEmptyState ? (
          <EmptyState
            title={isSearchMode ? "No results found" : "No bookmarks yet"}
            description={
              isSearchMode
                ? `No bookmarks match "${query}". Try a different search term.`
                : "Your saved bookmarks will appear here. Start adding some!"
            }
          />
        ) : (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {displayItems.map((item, index) => (
              <BookmarkListItem key={item.id} bookmark={item} index={index} />
            ))}
          </motion.div>
        )}

        {/* Infinite scroll trigger */}
        {!isSearchMode && hasNextPage && !isInitialLoading && (
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {isFetchingNextPage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 text-ink-400"
              >
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink-100 border-t-accent" />
                <span className="text-xs font-mono uppercase tracking-widest">
                  Loading...
                </span>
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
