import { motion } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import type { Timeline as TimelineType } from "@rag-bookmarks/shared";

interface TimelineProps {
  data: TimelineType;
  index?: number;
}

export function Timeline({ data, index = 0 }: TimelineProps) {
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

      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-3 top-2 bottom-2 w-0.5"
          style={{ backgroundColor: colors.border }}
        />

        <div className="space-y-4">
          {data.events.map((event, i) => (
            <div key={i} className="flex gap-4 relative">
              {/* Dot */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10"
                style={{ backgroundColor: colors.accent }}
              >
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>

              {/* Content */}
              <div className="flex-1 pt-0.5">
                <p
                  style={{ color: colors.textMuted }}
                  className="text-xs font-medium"
                >
                  {event.date}
                </p>
                <h4
                  style={{ color: colors.textPrimary }}
                  className="text-sm font-semibold mt-0.5"
                >
                  {event.title}
                </h4>
                <p
                  style={{ color: colors.textSecondary }}
                  className="text-sm mt-1"
                >
                  {event.description}
                </p>
                {event.significance && (
                  <p
                    style={{ color: colors.accent }}
                    className="text-xs mt-1 font-medium"
                  >
                    {event.significance}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
