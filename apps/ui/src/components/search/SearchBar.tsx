import { forwardRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl mx-auto group"
      >
        <div className="relative rounded-xl bg-white shadow-[0_0_0_1px_rgba(228,228,231,0.6),0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-300 group-focus-within:shadow-[0_0_0_2px_rgba(24,24,27,0.1),0_8px_20px_rgba(0,0,0,0.06)]">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-900">
            <Search className="h-5 w-5" />
          </div>

          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "h-12 w-full rounded-xl bg-transparent pl-12 pr-12 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            )}
          />

          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              <div className="hidden sm:flex items-center gap-1 opacity-40">
                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 font-mono text-[10px] font-medium text-zinc-500 opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

SearchBar.displayName = "SearchBar";
