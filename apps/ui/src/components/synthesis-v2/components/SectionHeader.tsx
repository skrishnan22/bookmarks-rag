import { motion } from "framer-motion";
import {
  Lightbulb,
  Target,
  Puzzle,
  BarChart3,
  BookOpen,
  Star,
  AlertTriangle,
  HelpCircle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "../ThemeProvider";
import type { SectionHeader as SectionHeaderType } from "@rag-bookmarks/shared";

const iconMap = {
  lightbulb: Lightbulb,
  target: Target,
  puzzle: Puzzle,
  chart: BarChart3,
  book: BookOpen,
  star: Star,
  warning: AlertTriangle,
  question: HelpCircle,
  check: CheckCircle,
  arrow: ArrowRight,
} as const;

interface SectionHeaderProps {
  data: SectionHeaderType;
  index?: number;
  sectionNumber?: number;
}

export function SectionHeader({ data, index = 0, sectionNumber }: SectionHeaderProps) {
  const { colors, theme } = useTheme();
  const Icon = data.icon ? iconMap[data.icon] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{ marginTop: theme.spacing.sectionGap }}
    >
      {/* Optional section number */}
      {sectionNumber !== undefined && (
        <span
          className="text-xs font-bold tracking-widest mb-2 block"
          style={{ color: colors.accent }}
        >
          {String(sectionNumber).padStart(2, "0")}
        </span>
      )}

      {/* Title with inline icon */}
      <div className="flex items-center gap-3">
        {Icon && (
          <Icon className="h-6 w-6" style={{ color: colors.accent }} />
        )}
        <h2
          style={{ color: colors.textPrimary }}
          className="text-2xl font-bold"
        >
          {data.title}
        </h2>
      </div>

      {/* Subtitle */}
      {data.subtitle && (
        <p
          style={{ color: colors.textMuted }}
          className="text-base mt-2 ml-0"
        >
          {data.subtitle}
        </p>
      )}

      {/* Decorative underline */}
      <div className="flex items-center gap-2 mt-4">
        <div
          className="h-0.5 w-12"
          style={{ backgroundColor: colors.accent }}
        />
        <div
          className="h-0.5 w-6"
          style={{ backgroundColor: colors.border }}
        />
        <div
          className="h-0.5 w-3"
          style={{ backgroundColor: colors.border }}
        />
      </div>
    </motion.div>
  );
}
