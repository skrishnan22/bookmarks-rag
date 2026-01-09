import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BookmarkListItem } from "~/components/bookmarks/BookmarkListItem";
import { EmptyState } from "~/components/bookmarks/EmptyState";
import { LoadingState } from "~/components/bookmarks/LoadingState";
import { SearchBar } from "~/components/search/SearchBar";
import { useDebounce } from "~/hooks/useDebounce";
import {
  useBookmarks,
  useSearchBookmarks,
  flattenBookmarks,
} from "~/hooks/useBookmarks";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
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
    <div className="min-h-screen bg-transparent">
      <div className="relative pt-20 pb-12 px-4">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Your Bookmarks
          </h1>
          <p className="text-lg text-zinc-400 font-light max-w-xl mx-auto">
            A curated collection of your reading list, resources, and
            inspiration.
          </p>

          <div className="max-w-xl mx-auto pt-4 relative z-10">
            <SearchBar
              ref={searchInputRef}
              value={query}
              onChange={setQuery}
              placeholder="Search through your collection..."
              loading={isSearching}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 pb-20">
        {isInitialLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
          </div>
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
          <div className="space-y-4">
            {displayItems.map((item) => (
              <BookmarkListItem key={item.id} bookmark={item} />
            ))}
          </div>
        )}

        {!isSearchMode && hasNextPage && !isInitialLoading && (
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {isFetchingNextPage && (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
