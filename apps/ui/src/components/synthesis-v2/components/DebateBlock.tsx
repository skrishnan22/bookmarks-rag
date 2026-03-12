import { useState } from "react";
import { motion } from "framer-motion";
import { Swords, ExternalLink } from "lucide-react";
import { useTheme } from "../ThemeProvider";
import type { DebateBlock as DebateBlockType } from "@rag-bookmarks/shared";

function isValidUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

interface DebateBlockProps {
  data: DebateBlockType;
  index?: number;
}

export function DebateBlock({ data, index = 0 }: DebateBlockProps) {
  const { colors, theme } = useTheme();
  const [hoveredSide, setHoveredSide] = useState<"a" | "b" | null>(null);

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
      {/* Tension header */}
      <div
        className="px-6 py-4 flex items-center gap-3"
        style={{
          background: `linear-gradient(135deg, ${colors.debateBg}, ${colors.surface})`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Swords className="h-5 w-5 shrink-0" style={{ color: colors.debateBorder }} />
        <span
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: colors.debateBorder }}
        >
          Your sources disagree
        </span>
      </div>

      {/* Tension question */}
      <div className="px-6 pt-5 pb-2">
        <h3
          className="text-xl font-bold leading-snug"
          style={{ color: colors.textPrimary }}
        >
          {data.tension}
        </h3>
      </div>

      {/* Side-by-side debate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Side A */}
        {[
          { side: data.sideA, key: "a" as const, positionColor: colors.success },
          { side: data.sideB, key: "b" as const, positionColor: colors.error },
        ].map(({ side, key, positionColor }, idx) => {
          const hasValidUrl = isValidUrl(side.source.url);
          const Tag = hasValidUrl ? motion.a : motion.div;
          const linkProps = hasValidUrl
            ? { href: side.source.url, target: "_blank" as const, rel: "noopener noreferrer" }
            : {};

          return (
            <Tag
              key={key}
              {...linkProps}
              className="block px-6 py-5 transition-colors duration-200 group cursor-pointer"
              style={{
                backgroundColor: hoveredSide === key ? colors.surfaceHover : "transparent",
                ...(idx === 0 ? { borderRight: `1px solid ${colors.border}` } : {}),
              }}
              onHoverStart={() => setHoveredSide(key)}
              onHoverEnd={() => setHoveredSide(null)}
            >
              <div
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: positionColor }}
              >
                {side.position}
              </div>
              <blockquote
                className="text-base italic leading-relaxed mb-4"
                style={{ color: colors.textSecondary }}
              >
                "{side.quote}"
              </blockquote>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: colors.textMuted }}
                >
                  {side.source.title}
                </span>
                {hasValidUrl && (
                  <ExternalLink
                    className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-70 transition-opacity"
                    style={{ color: colors.textMuted }}
                  />
                )}
              </div>
            </Tag>
          );
        })}
      </div>

      {/* Synthesis / the tension explained */}
      {data.synthesis && (
        <div
          className="px-6 py-4"
          style={{
            backgroundColor: colors.surfaceHover,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{ color: colors.textSecondary }}
          >
            <span className="font-semibold" style={{ color: colors.textPrimary }}>
              The tension:
            </span>{" "}
            {data.synthesis}
          </p>
        </div>
      )}
    </motion.div>
  );
}
