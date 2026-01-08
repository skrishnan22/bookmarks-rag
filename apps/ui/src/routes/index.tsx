import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookmarkListItem } from "~/components/bookmarks/BookmarkListItem";
import { EmptyState } from "~/components/bookmarks/EmptyState";
import { LoadingState } from "~/components/bookmarks/LoadingState";
import { SearchBar } from "~/components/search/SearchBar";
import { useDebounce } from "~/hooks/useDebounce";
import {
  getBookmarks,
  searchBookmarks,
  type Bookmark,
  type SearchResult,
} from "~/lib/api";

export const Route = createFileRoute("/")({
  component: Home,
});

const PAGE_SIZE = 20;

function Home() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const isSearchMode = debouncedQuery.length >= 2;

  const loadBookmarks = useCallback(async (currentOffset: number) => {
    setLoading(true);
    try {
      const response = await getBookmarks(PAGE_SIZE, currentOffset);
      if (response.success) {
        const newBookmarks = response.data;
        setBookmarks((prev) =>
          currentOffset === 0 ? newBookmarks : [...prev, ...newBookmarks]
        );
        setHasMore(newBookmarks.length === PAGE_SIZE);
        setOffset(currentOffset + newBookmarks.length);
      }
    } catch (error) {
      console.error("Failed to load bookmarks:", error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  const loadSearchResults = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const response = await searchBookmarks(searchQuery, 50);
      if (response.success) {
        setSearchResults(response.data.results);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookmarks(0);
  }, [loadBookmarks]);

  useEffect(() => {
    if (isSearchMode) {
      loadSearchResults(debouncedQuery);
    } else {
      setSearchResults([]);
    }
  }, [debouncedQuery, isSearchMode, loadSearchResults]);

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
    if (isSearchMode || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          loadBookmarks(offset);
        }
      },
      { threshold: 0.1 }
    );

    const current = loadMoreRef.current;
    if (current) observer.observe(current);
    return () => {
      if (current) observer.unobserve(current);
    };
  }, [hasMore, loading, offset, loadBookmarks, isSearchMode]);

  const displayItems = isSearchMode
    ? searchResults.map((r) => ({
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

  const showEmptyState =
    !initialLoading && !loading && displayItems.length === 0;

  return (
    <div className="min-h-screen bg-transparent">
      {/* Hero Header */}
      <div className="relative pt-20 pb-12 px-4">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Your Bookmarks
          </h1>
          <p className="text-lg text-zinc-400 font-light max-w-xl mx-auto">
            A curated collection of your reading list, resources, and inspiration.
          </p>

          <div className="max-w-xl mx-auto pt-4 relative z-10">
            <SearchBar
              ref={searchInputRef}
              value={query}
              onChange={setQuery}
              placeholder="Search through your collection..."
              loading={loading && isSearchMode}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 pb-20">
        {initialLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
          </div>
        ) : loading && isSearchMode ? (
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

        {!isSearchMode && hasMore && !initialLoading && (
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {loading && (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
