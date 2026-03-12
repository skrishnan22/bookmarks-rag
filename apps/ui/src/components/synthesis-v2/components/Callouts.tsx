import { motion } from "framer-motion";
import { AlertTriangle, Info, AlertCircle, Lightbulb, HelpCircle } from "lucide-react";
import { useTheme } from "../ThemeProvider";
import type {
  WarningCallout as WarningCalloutType,
  TipCallout as TipCalloutType,
  QuestionCallout as QuestionCalloutType,
} from "@rag-bookmarks/shared";

// WarningCallout
interface WarningCalloutProps {
  data: WarningCalloutType;
  index?: number;
}

const severityConfig = {
  info: { icon: Info, accentColor: "#2563eb", label: "Note" },
  warning: { icon: AlertTriangle, accentColor: "#d97706", label: "Warning" },
  error: { icon: AlertCircle, accentColor: "#dc2626", label: "Important" },
};

export function WarningCallout({ data, index = 0 }: WarningCalloutProps) {
  const { colors, theme } = useTheme();
  const config = severityConfig[data.severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
      }}
      className="relative overflow-hidden shadow-sm"
    >
      {/* Colored accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: config.accentColor }}
      />

      <div className="pl-6 pr-5 py-5">
        {/* Header with animated icon */}
        <div className="flex items-start gap-3">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 + 0.1, type: "spring", stiffness: 200 }}
            className="shrink-0 p-2 rounded-lg mt-0.5"
            style={{ backgroundColor: `${config.accentColor}15` }}
          >
            <Icon
              className="h-5 w-5"
              style={{ color: config.accentColor }}
            />
          </motion.div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: config.accentColor }}
              >
                {config.label}
              </span>
            </div>
            <p
              style={{ color: colors.textPrimary }}
              className="text-base font-semibold leading-snug mb-2"
            >
              {data.title}
            </p>
            <p
              style={{ color: colors.textSecondary }}
              className="text-sm leading-relaxed"
            >
              {data.message}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// TipCallout
interface TipCalloutProps {
  data: TipCalloutType;
  index?: number;
}

export function TipCallout({ data, index = 0 }: TipCalloutProps) {
  const { colors, theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
      }}
      className="relative overflow-hidden shadow-sm"
    >
      {/* Accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: colors.accent }}
      />

      <div className="pl-6 pr-5 py-5">
        <div className="flex items-start gap-3">
          {/* Animated lightbulb */}
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: index * 0.05 + 0.1, type: "spring", stiffness: 200 }}
            className="shrink-0 p-2 rounded-lg mt-0.5"
            style={{ backgroundColor: colors.accentLight }}
          >
            <Lightbulb
              className="h-5 w-5"
              style={{ color: colors.accent }}
            />
          </motion.div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: colors.accent }}
              >
                Pro Tip
              </span>
            </div>
            {data.title && (
              <p
                style={{ color: colors.textPrimary }}
                className="text-base font-semibold leading-snug mb-2"
              >
                {data.title}
              </p>
            )}
            <p
              style={{ color: colors.textSecondary }}
              className="text-sm leading-relaxed"
            >
              {data.tip}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// QuestionCallout - provocative, inviting exploration
interface QuestionCalloutProps {
  data: QuestionCalloutType;
  index?: number;
}

export function QuestionCallout({ data, index = 0 }: QuestionCalloutProps) {
  const { colors, theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
      }}
      className="relative overflow-hidden shadow-sm"
    >
      {/* Large question mark decoration */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.06, scale: 1 }}
        transition={{ delay: index * 0.05 + 0.2, duration: 0.4 }}
        className="absolute -right-4 -bottom-4 text-[100px] font-serif leading-none select-none pointer-events-none"
        style={{ color: colors.questionBorder }}
      >
        ?
      </motion.div>

      {/* Accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: colors.questionBorder }}
      />

      <div className="relative pl-6 pr-6 py-6">
        {/* Label */}
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle
            className="h-4 w-4"
            style={{ color: colors.questionBorder }}
          />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: colors.questionBorder }}
          >
            Worth Exploring
          </span>
        </div>

        {/* Question - large italic */}
        <p
          style={{ color: colors.textPrimary }}
          className="text-xl font-medium italic leading-relaxed"
        >
          {data.question}
        </p>

        {/* Context */}
        {data.context && (
          <p
            style={{ color: colors.textMuted }}
            className="text-sm mt-4 leading-relaxed"
          >
            {data.context}
          </p>
        )}
      </div>
    </motion.div>
  );
}
