import { motion } from "framer-motion";
import { Route, ExternalLink, ChevronRight } from "lucide-react";
import { useTheme } from "../ThemeProvider";
import type { ReadingPath as ReadingPathType } from "@rag-bookmarks/shared";

interface ReadingPathProps {
  data: ReadingPathType;
  index?: number;
}

function isValidUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function ReadingPath({ data, index = 0 }: ReadingPathProps) {
  const { colors, theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
      }}
      className="overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="px-6 py-5 flex items-center gap-3">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-full"
          style={{ backgroundColor: colors.accentLight }}
        >
          <Route className="h-4 w-4" style={{ color: colors.accent }} />
        </div>
        <div>
          <h3
            className="text-lg font-bold leading-snug"
            style={{ color: colors.textPrimary }}
          >
            {data.title}
          </h3>
          <p
            className="text-xs font-medium"
            style={{ color: colors.textMuted }}
          >
            {data.steps.length} bookmarks, in order
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-6 pb-5">
        {data.steps.map((step, i) => {
          const hasValidUrl = isValidUrl(step.source.url);
          const Tag = hasValidUrl ? "a" : "div";
          const linkProps = hasValidUrl
            ? { href: step.source.url, target: "_blank" as const, rel: "noopener noreferrer" }
            : {};

          return (
            <Tag
              key={step.source.bookmarkId || i}
              {...linkProps}
              className="group flex items-start gap-4 py-4 transition-colors duration-150"
              style={{
                borderTop: i > 0 ? `1px solid ${colors.border}` : undefined,
              }}
            >
              {/* Step number */}
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-sm font-bold"
                style={{
                  backgroundColor: colors.accentLight,
                  color: colors.accent,
                }}
              >
                {i + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-sm font-semibold group-hover:underline"
                    style={{ color: colors.textPrimary }}
                  >
                    {step.source.title}
                  </span>
                  {hasValidUrl && (
                    <ExternalLink
                      className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-70 transition-opacity"
                      style={{ color: colors.textMuted }}
                    />
                  )}
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: colors.textMuted }}
                >
                  {step.reason}
                </p>
              </div>

              {/* Arrow */}
              {hasValidUrl && (
                <ChevronRight
                  className="h-4 w-4 shrink-0 mt-1 opacity-0 group-hover:opacity-70 transition-opacity"
                  style={{ color: colors.textMuted }}
                />
              )}
            </Tag>
          );
        })}
      </div>
    </motion.div>
  );
}
