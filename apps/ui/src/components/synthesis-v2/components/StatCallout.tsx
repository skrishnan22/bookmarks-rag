import { motion } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import type { StatCallout as StatCalloutType } from "@rag-bookmarks/shared";

interface StatCalloutProps {
  data: StatCalloutType;
  index?: number;
}

export function StatCallout({ data, index = 0 }: StatCalloutProps) {
  const { colors, theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
      className="text-center py-8 px-6"
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
      }}
    >
      {/* Big stat number */}
      <div
        className="text-6xl md:text-7xl font-bold tabular-nums leading-none mb-2"
        style={{ color: colors.accent }}
      >
        {data.value}
      </div>

      {/* Label */}
      <div
        className="text-lg font-medium mb-3"
        style={{ color: colors.textPrimary }}
      >
        {data.label}
      </div>

      {/* Context */}
      {data.context && (
        <p
          className="text-sm max-w-md mx-auto leading-relaxed"
          style={{ color: colors.textMuted }}
        >
          {data.context}
        </p>
      )}
    </motion.div>
  );
}
