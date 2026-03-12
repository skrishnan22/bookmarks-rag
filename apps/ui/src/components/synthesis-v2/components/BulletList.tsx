import { motion } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import type { BulletList as BulletListType } from "@rag-bookmarks/shared";

interface BulletListProps {
  data: BulletListType;
  index?: number;
}

export function BulletList({ data, index = 0 }: BulletListProps) {
  const { colors, theme } = useTheme();
  const ListTag = data.ordered ? "ol" : "ul";

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
          className="text-sm font-semibold mb-3"
        >
          {data.title}
        </h3>
      )}

      <ListTag className={`space-y-2 ${data.ordered ? "list-decimal" : ""} pl-4`}>
        {data.items.map((item, i) => (
          <li
            key={i}
            style={{ color: colors.textSecondary }}
            className="text-sm"
          >
            {!data.ordered && (
              <span style={{ color: colors.accent }} className="mr-2">
                &bull;
              </span>
            )}
            {item}
          </li>
        ))}
      </ListTag>
    </motion.div>
  );
}
