import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { useTheme } from "../ThemeProvider";
import type { QuoteBlock as QuoteBlockType } from "@rag-bookmarks/shared";

interface QuoteBlockProps {
  data: QuoteBlockType;
  index?: number;
}

export function QuoteBlock({ data, index = 0 }: QuoteBlockProps) {
  const { colors } = useTheme();

  return (
    <motion.blockquote
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="relative py-10 px-4"
    >
      {/* Top decorative line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: index * 0.05 + 0.1, duration: 0.4 }}
        className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-3"
      >
        <div className="h-px w-16" style={{ backgroundColor: colors.border }} />
        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.accent }} />
        <div className="h-px w-16" style={{ backgroundColor: colors.border }} />
      </motion.div>

      {/* Animated quote marks */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 0.15, y: 0 }}
        transition={{ delay: index * 0.05 + 0.2, duration: 0.3 }}
        className="absolute top-6 left-1/2 -translate-x-1/2 text-6xl font-serif leading-none select-none"
        style={{ color: colors.accent }}
      >
        "
      </motion.div>

      {/* Quote text - large, centered */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 + 0.3, duration: 0.4 }}
        style={{ color: colors.textPrimary }}
        className="text-xl md:text-2xl italic leading-relaxed text-center max-w-3xl mx-auto mt-8"
      >
        {data.quote}
      </motion.p>

      {/* Attribution */}
      {(data.attribution || data.source) && (
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 + 0.5, duration: 0.3 }}
          className="mt-6 flex items-center justify-center gap-3"
        >
          {data.attribution && (
            <span style={{ color: colors.textMuted }} className="text-sm font-medium">
              — {data.attribution}
            </span>
          )}
          {data.source && (
            <a
              href={data.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all hover:shadow-sm"
              style={{
                backgroundColor: colors.surfaceHover,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
              }}
            >
              <span className="truncate max-w-[150px]">{data.source.title}</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          )}
        </motion.footer>
      )}

      {/* Bottom decorative line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: index * 0.05 + 0.4, duration: 0.4 }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-3"
      >
        <div className="h-px w-16" style={{ backgroundColor: colors.border }} />
        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.accent }} />
        <div className="h-px w-16" style={{ backgroundColor: colors.border }} />
      </motion.div>
    </motion.blockquote>
  );
}
