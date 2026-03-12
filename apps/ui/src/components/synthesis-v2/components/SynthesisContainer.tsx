import { motion } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import type { SynthesisContainer as SynthesisContainerType } from "@rag-bookmarks/shared";

interface SynthesisContainerProps {
  data: SynthesisContainerType;
  index?: number;
}

export function SynthesisContainer({ data, index = 0 }: SynthesisContainerProps) {
  const { colors } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="mb-6"
    >
      <h1
        style={{ color: colors.textPrimary }}
        className="text-2xl font-bold tracking-tight"
      >
        {data.title}
      </h1>
      {data.subtitle && (
        <p
          style={{ color: colors.textMuted }}
          className="text-sm mt-2"
        >
          {data.subtitle}
        </p>
      )}
    </motion.div>
  );
}
