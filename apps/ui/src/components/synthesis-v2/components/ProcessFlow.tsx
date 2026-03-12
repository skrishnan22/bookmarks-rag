import { motion } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import type { ProcessFlow as ProcessFlowType } from "@rag-bookmarks/shared";

interface ProcessFlowProps {
  data: ProcessFlowType;
  index?: number;
}

export function ProcessFlow({ data, index = 0 }: ProcessFlowProps) {
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

      <div className="space-y-4">
        {data.steps.map((step, i) => (
          <div key={i} className="flex gap-4">
            {/* Step number */}
            <div
              style={{
                backgroundColor: colors.accent,
                color: "#fff",
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            >
              {step.number}
            </div>

            {/* Step content */}
            <div className="flex-1 pt-0.5">
              <h4
                style={{ color: colors.textPrimary }}
                className="text-sm font-semibold"
              >
                {step.title}
              </h4>
              <p
                style={{ color: colors.textSecondary }}
                className="text-sm mt-1"
              >
                {step.description}
              </p>
              {step.tips && step.tips.length > 0 && (
                <div className="mt-2 space-y-1">
                  {step.tips.map((tip, j) => (
                    <p
                      key={j}
                      style={{ color: colors.textMuted }}
                      className="text-xs flex items-start gap-1.5"
                    >
                      <span style={{ color: colors.accent }}>Tip:</span>
                      {tip}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
