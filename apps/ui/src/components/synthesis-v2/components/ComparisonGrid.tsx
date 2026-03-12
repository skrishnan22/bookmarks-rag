import { motion } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import type { ComparisonGrid as ComparisonGridType } from "@rag-bookmarks/shared";

interface ComparisonGridProps {
  data: ComparisonGridType;
  index?: number;
}

export function ComparisonGrid({ data, index = 0 }: ComparisonGridProps) {
  const { colors, theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderStyle: "solid",
        borderRadius: theme.borderRadius,
        padding: theme.spacing.cardPadding,
      }}
    >
      {data.title && (
        <h3
          style={{ color: colors.textPrimary }}
          className="text-base font-semibold mb-4"
        >
          {data.title}
        </h3>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Left Column */}
        <div
          style={{
            backgroundColor: colors.accentLight,
            borderRadius: theme.borderRadius,
          }}
          className="p-3"
        >
          <h4
            style={{ color: colors.accent }}
            className="text-sm font-semibold mb-2"
          >
            {data.left.label}
          </h4>
          <ul className="space-y-1.5">
            {data.left.points.map((point, i) => (
              <li
                key={i}
                style={{ color: colors.textSecondary }}
                className="text-sm flex items-start gap-2"
              >
                <span style={{ color: colors.accent }} className="mt-1">
                  &bull;
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Right Column */}
        <div
          style={{
            backgroundColor: colors.surfaceHover,
            borderRadius: theme.borderRadius,
          }}
          className="p-3"
        >
          <h4
            style={{ color: colors.textSecondary }}
            className="text-sm font-semibold mb-2"
          >
            {data.right.label}
          </h4>
          <ul className="space-y-1.5">
            {data.right.points.map((point, i) => (
              <li
                key={i}
                style={{ color: colors.textSecondary }}
                className="text-sm flex items-start gap-2"
              >
                <span style={{ color: colors.textMuted }} className="mt-1">
                  &bull;
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
