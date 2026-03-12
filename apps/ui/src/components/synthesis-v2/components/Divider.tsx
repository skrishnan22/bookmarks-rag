import { motion } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import type { Divider as DividerType } from "@rag-bookmarks/shared";

interface DividerProps {
  data: DividerType;
}

export function Divider({ data }: DividerProps) {
  const { colors, theme } = useTheme();

  // Ornament style - decorative centered symbol
  if (data.style === "gradient") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center gap-4 py-8"
        style={{
          marginTop: theme.spacing.sectionGap,
          marginBottom: theme.spacing.componentGap,
        }}
      >
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="h-px flex-1 max-w-24 origin-right"
          style={{
            background: `linear-gradient(to left, ${colors.border}, transparent)`,
          }}
        />
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="h-2 w-2 rotate-45"
          style={{ backgroundColor: colors.accent }}
        />
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="h-px flex-1 max-w-24 origin-left"
          style={{
            background: `linear-gradient(to right, ${colors.border}, transparent)`,
          }}
        />
      </motion.div>
    );
  }

  // Standard divider styles
  const styleMap = {
    solid: { borderStyle: "solid" as const },
    dashed: { borderStyle: "dashed" as const },
    dotted: { borderStyle: "dotted" as const },
  };

  const dividerStyle = {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...styleMap[data.style as keyof typeof styleMap],
  };

  return (
    <hr
      style={{
        ...dividerStyle,
        marginTop: theme.spacing.sectionGap,
        marginBottom: theme.spacing.componentGap,
      }}
    />
  );
}

// Ornamental section divider - can be used standalone
export function OrnamentalDivider() {
  const { colors, theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-center gap-4 py-10"
      style={{
        marginTop: theme.spacing.sectionGap,
      }}
    >
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="h-px flex-1 max-w-32 origin-right"
        style={{
          background: `linear-gradient(to left, ${colors.border}, transparent)`,
        }}
      />
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.3, type: "spring" }}
        className="flex items-center gap-2"
      >
        <div className="h-1 w-1 rounded-full" style={{ backgroundColor: colors.border }} />
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <div className="h-1 w-1 rounded-full" style={{ backgroundColor: colors.border }} />
      </motion.div>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="h-px flex-1 max-w-32 origin-left"
        style={{
          background: `linear-gradient(to right, ${colors.border}, transparent)`,
        }}
      />
    </motion.div>
  );
}
