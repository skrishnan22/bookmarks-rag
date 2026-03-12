import { motion } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import type { HeroBlock as HeroBlockType } from "@rag-bookmarks/shared";

interface HeroBlockProps {
  data: HeroBlockType;
  index?: number;
}

export function HeroBlock({ data, index = 0 }: HeroBlockProps) {
  const { colors, theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
        minHeight: "200px",
      }}
    >
      {/* Subtle gradient backdrop */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          background: `radial-gradient(ellipse at 30% 50%, ${colors.accent}, transparent 70%)`,
        }}
      />

      <div className="relative px-8 py-10 flex flex-col justify-center">
        {/* Main headline — large, bold, commanding */}
        <h2
          className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-4"
          style={{ color: colors.textPrimary }}
        >
          {data.headline}
        </h2>

        {/* Subtext */}
        <p
          className="text-lg leading-relaxed max-w-2xl"
          style={{ color: colors.textMuted }}
        >
          {data.subtext}
        </p>

        {/* Visual addon based on type */}
        {data.visual === "stat" && data.stat && (
          <div className="mt-8 flex items-baseline gap-3">
            <span
              className="text-6xl font-bold tabular-nums"
              style={{ color: colors.accent }}
            >
              {data.stat.value}
            </span>
            <span
              className="text-lg font-medium"
              style={{ color: colors.textMuted }}
            >
              {data.stat.label}
            </span>
          </div>
        )}

        {data.visual === "quote" && data.quote && (
          <blockquote className="mt-8 pl-6 border-l-4" style={{ borderColor: colors.accent }}>
            <p
              className="text-xl italic leading-relaxed"
              style={{ color: colors.textSecondary }}
            >
              "{data.quote.text}"
            </p>
            {data.quote.attribution && (
              <cite
                className="block mt-2 text-sm font-medium not-italic"
                style={{ color: colors.textMuted }}
              >
                — {data.quote.attribution}
              </cite>
            )}
          </blockquote>
        )}

        {data.visual === "svg" && data.svgContent && (
          <div
            className="mt-8 max-w-lg"
            dangerouslySetInnerHTML={{ __html: data.svgContent }}
          />
        )}
      </div>
    </motion.div>
  );
}
