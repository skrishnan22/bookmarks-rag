import { motion } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import type { NarrativeBlock as NarrativeBlockType } from "@rag-bookmarks/shared";

interface NarrativeBlockProps {
  data: NarrativeBlockType;
  index?: number;
  isFirst?: boolean; // Use drop cap for first narrative block
}

export function NarrativeBlock({ data, index = 0, isFirst = false }: NarrativeBlockProps) {
  const { colors } = useTheme();

  // Simple citation rendering - wraps [n] in styled spans
  const renderContentWithCitations = (content: string, skipFirst = false) => {
    const parts = content.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      if (/^\[\d+\]$/.test(part)) {
        return (
          <span
            key={i}
            style={{ color: colors.accent }}
            className="font-semibold cursor-pointer hover:underline"
          >
            {part}
          </span>
        );
      }
      // Skip first character if we're doing drop cap
      if (i === 0 && skipFirst && part.length > 0) {
        return part.slice(1);
      }
      return part;
    });
  };

  // For drop cap, extract first letter
  const firstLetter = data.content.charAt(0);
  const shouldDropCap = isFirst && /[A-Za-z]/.test(firstLetter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="max-w-3xl"
    >
      <p
        style={{ color: colors.textSecondary }}
        className="text-base leading-relaxed"
      >
        {shouldDropCap && (
          <span
            className="float-left text-5xl font-bold leading-none pr-3 pt-1"
            style={{ color: colors.textPrimary }}
          >
            {firstLetter}
          </span>
        )}
        {renderContentWithCitations(data.content, shouldDropCap)}
      </p>
    </motion.div>
  );
}
