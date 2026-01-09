import { forwardRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    { value, onChange, placeholder = "Search bookmarks...", loading = false },
    ref
  ) => {
    return (
      <div className="relative w-full group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-purple-400">
          <Search className="h-5 w-5" />
        </div>

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-14 w-full rounded-2xl border border-white/5 bg-white/5 pl-12 pr-12 text-base text-zinc-100 shadow-xl backdrop-blur-md transition-all",
            "placeholder:text-zinc-500",
            "focus:border-purple-500/30 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-purple-500/10",
            "hover:bg-white/10 hover:border-white/10"
          )}
        />

        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          ) : (
            <div className="hidden items-center gap-1 opacity-50 sm:flex">
              <kbd className="flex h-5 items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-1.5 font-sans text-[10px] font-medium text-zinc-400">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          )}
        </div>
      </div>
    );
  }
);

SearchBar.displayName = "SearchBar";
