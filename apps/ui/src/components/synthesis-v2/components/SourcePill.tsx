import { ExternalLink } from "lucide-react";
import { useTheme } from "../ThemeProvider";

interface SourcePillProps {
  title: string;
  url: string;
  bookmarkId: string;
}

function isValidUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function SourcePill({ title, url }: SourcePillProps) {
  const { colors } = useTheme();
  const hasValidUrl = isValidUrl(url);

  const Tag = hasValidUrl ? "a" : "span";
  const linkProps = hasValidUrl
    ? { href: url, target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <Tag
      {...linkProps}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        color: colors.textSecondary,
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium
                 hover:border-current hover:shadow-sm transition-all duration-200 group"
    >
      <span className="truncate max-w-[250px]">{title}</span>
      {hasValidUrl && (
        <ExternalLink
          className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity shrink-0"
          style={{ color: colors.textMuted }}
        />
      )}
    </Tag>
  );
}
