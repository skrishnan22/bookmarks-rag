import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, ChevronDown, BookOpen, ArrowRight } from "lucide-react";
import { useTheme } from "../ThemeProvider";
import type { SourceCluster as SourceClusterType } from "@rag-bookmarks/shared";

interface SourceClusterProps {
  data: SourceClusterType;
  index?: number;
}

export function SourceCluster({ data, index = 0 }: SourceClusterProps) {
  const { colors, theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleSources = isExpanded ? data.sources : data.sources.slice(0, 1);
  const hasMoreSources = data.sources.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
      }}
      className="overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-opacity-50 transition-colors"
        style={{ backgroundColor: `${colors.accent}08` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${colors.accent}15` }}
          >
            <BookOpen className="h-4 w-4" style={{ color: colors.accent }} />
          </div>
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: colors.accent }}
            >
              {data.label || "Explore the Sources"}
            </p>
            <p className="text-xs" style={{ color: colors.textMuted }}>
              {data.sources.length} article{data.sources.length !== 1 ? "s" : ""} to dive into
            </p>
          </div>
        </div>

        {hasMoreSources && (
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            style={{ color: colors.textMuted }}
          />
        )}
      </div>

      {/* Source cards */}
      <div className="px-4 pb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={isExpanded ? "expanded" : "collapsed"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 pt-2"
          >
            {visibleSources.map((source, i) => (
              <motion.a
                key={source.bookmarkId}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                style={{
                  backgroundColor: colors.surfaceHover,
                  borderColor: colors.border,
                }}
                className="block p-4 rounded-lg border hover:shadow-sm hover:border-current transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4
                      style={{ color: colors.textPrimary }}
                      className="font-medium text-sm leading-snug group-hover:underline"
                    >
                      {source.title}
                    </h4>
                  </div>
                  <div
                    className="shrink-0 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: `${colors.accent}10` }}
                  >
                    <ArrowRight className="h-4 w-4" style={{ color: colors.accent }} />
                  </div>
                </div>
              </motion.a>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Expand/collapse button */}
        {hasMoreSources && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="mt-3 w-full py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
            style={{
              color: colors.textMuted,
              backgroundColor: colors.surfaceHover,
            }}
          >
            + {data.sources.length - 1} more source{data.sources.length - 1 !== 1 ? "s" : ""}
          </button>
        )}
      </div>
    </motion.div>
  );
}
