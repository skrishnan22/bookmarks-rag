import { motion } from "framer-motion";
import { BookOpen, ExternalLink } from "lucide-react";
import { useTheme } from "../ThemeProvider";
import type { DeepDiveLink as DeepDiveLinkType } from "@rag-bookmarks/shared";

interface DeepDiveLinkProps {
  data: DeepDiveLinkType;
  index?: number;
}

export function DeepDiveLink({ data, index = 0 }: DeepDiveLinkProps) {
  const { colors, theme } = useTheme();

  return (
    <motion.a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
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
      className="flex items-start gap-3 hover:border-current transition-colors group block"
    >
      <div
        style={{ backgroundColor: colors.accentLight }}
        className="p-2 rounded-lg shrink-0"
      >
        <BookOpen className="h-4 w-4" style={{ color: colors.accent }} />
      </div>

      <div className="flex-1 min-w-0">
        <p
          style={{ color: colors.textPrimary }}
          className="text-sm font-semibold truncate group-hover:text-current"
        >
          {data.title}
        </p>
        <p
          style={{ color: colors.textMuted }}
          className="text-xs mt-1 line-clamp-2"
        >
          {data.reason}
        </p>
      </div>

      <ExternalLink
        className="h-4 w-4 opacity-50 group-hover:opacity-100 shrink-0 mt-1"
        style={{ color: colors.textMuted }}
      />
    </motion.a>
  );
}
