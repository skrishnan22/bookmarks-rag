import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTheme } from "../ThemeProvider";
import type { KeyTakeaway as KeyTakeawayType } from "@rag-bookmarks/shared";

interface KeyTakeawayProps {
  data: KeyTakeawayType;
  index?: number;
}

export function KeyTakeaway({ data, index = 0 }: KeyTakeawayProps) {
  const { colors, theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden"
      style={{ borderRadius: theme.borderRadius }}
    >
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${colors.accentLight} 0%, ${colors.surface} 50%, ${colors.surface} 100%)`,
        }}
      />

      {/* Animated shimmer overlay */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${colors.accent}20 50%, transparent 100%)`,
        }}
        animate={{
          x: ["-100%", "200%"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatDelay: 5,
          ease: "easeInOut",
        }}
      />

      {/* Large decorative quote marks */}
      <div
        className="absolute -top-4 -left-2 text-[120px] font-serif leading-none select-none pointer-events-none"
        style={{ color: colors.accent, opacity: 0.08 }}
      >
        "
      </div>
      <div
        className="absolute -bottom-16 -right-2 text-[120px] font-serif leading-none select-none pointer-events-none rotate-180"
        style={{ color: colors.accent, opacity: 0.08 }}
      >
        "
      </div>

      {/* Content */}
      <div className="relative px-8 py-12 md:px-12 md:py-16">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 + 0.2, duration: 0.4 }}
          className="flex items-center gap-2 mb-6"
        >
          <Sparkles className="h-5 w-5" style={{ color: colors.accent }} />
          <span
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color: colors.accent }}
          >
            The Big Insight
          </span>
        </motion.div>

        {/* Main takeaway - HUGE typography */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 + 0.3, duration: 0.5 }}
          style={{ color: colors.textPrimary }}
          className="text-3xl md:text-4xl font-bold leading-tight mb-8 max-w-4xl"
        >
          {data.takeaway}
        </motion.p>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: index * 0.05 + 0.5, duration: 0.4 }}
          className="h-1 w-24 mb-6 origin-left"
          style={{ backgroundColor: colors.accent }}
        />

        {/* Explanation */}
        {data.explanation && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.05 + 0.6, duration: 0.4 }}
            style={{ color: colors.textSecondary }}
            className="text-lg leading-relaxed max-w-3xl"
          >
            {data.explanation}
          </motion.p>
        )}

        {/* Confidence badge - social proof */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 + 0.7, duration: 0.4 }}
          className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            backgroundColor: `${colors.accent}15`,
            border: `1px solid ${colors.accent}30`,
          }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: colors.accent }}
          >
            Multiple sources converge on this idea
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
