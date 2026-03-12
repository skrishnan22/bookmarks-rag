import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ThemeName, Theme, ThemeColors } from "@rag-bookmarks/shared";

// We need to duplicate the theme data here since the shared package
// exports types but the actual theme objects aren't available in the browser build
const themes: Record<ThemeName, Theme> = {
  default: {
    name: "default",
    colors: {
      background: "#fafafa",
      surface: "#ffffff",
      surfaceHover: "#f9fafb",
      border: "#e5e7eb",
      borderAccent: "#d1d5db",
      textPrimary: "#18181b",
      textSecondary: "#3f3f46",
      textMuted: "#71717a",
      textAccent: "#d97706",
      accent: "#d97706",
      accentLight: "#fef3c7",
      accentDark: "#b45309",
      success: "#059669",
      successLight: "#d1fae5",
      warning: "#d97706",
      warningLight: "#fef3c7",
      error: "#dc2626",
      errorLight: "#fee2e2",
      info: "#2563eb",
      infoLight: "#dbeafe",
      insightBg: "#fffbeb",
      insightBorder: "#fcd34d",
      takeawayBg: "#ecfdf5",
      takeawayBorder: "#6ee7b7",
      tradeoffBg: "#fef3c7",
      tradeoffBorder: "#fbbf24",
      mentalModelBg: "#ede9fe",
      mentalModelBorder: "#a78bfa",
      questionBg: "#dbeafe",
      questionBorder: "#60a5fa",
      consensusBg: "#d1fae5",
      consensusBorder: "#34d399",
      debateBg: "#fce7f3",
      debateBorder: "#f472b6",
      pitfallBg: "#fee2e2",
      pitfallBorder: "#f87171",
    },
    typography: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headingWeight: "700",
      bodyWeight: "400",
    },
    spacing: {
      cardPadding: "1.25rem",
      sectionGap: "2.5rem",
      componentGap: "1.25rem",
    },
    borderRadius: "0.75rem",
  },
  warm: {
    name: "warm",
    colors: {
      background: "#fdf8f3",
      surface: "#fffcf7",
      surfaceHover: "#fef7ee",
      border: "#e7e0d6",
      borderAccent: "#d4c9bb",
      textPrimary: "#292524",
      textSecondary: "#44403c",
      textMuted: "#78716c",
      textAccent: "#c2410c",
      accent: "#c2410c",
      accentLight: "#ffedd5",
      accentDark: "#9a3412",
      success: "#15803d",
      successLight: "#dcfce7",
      warning: "#c2410c",
      warningLight: "#ffedd5",
      error: "#b91c1c",
      errorLight: "#fee2e2",
      info: "#1d4ed8",
      infoLight: "#dbeafe",
      insightBg: "#fff7ed",
      insightBorder: "#fb923c",
      takeawayBg: "#f0fdf4",
      takeawayBorder: "#86efac",
      tradeoffBg: "#fef9c3",
      tradeoffBorder: "#facc15",
      mentalModelBg: "#faf5ff",
      mentalModelBorder: "#c084fc",
      questionBg: "#eff6ff",
      questionBorder: "#93c5fd",
      consensusBg: "#ecfdf5",
      consensusBorder: "#4ade80",
      debateBg: "#fdf2f8",
      debateBorder: "#f9a8d4",
      pitfallBg: "#fef2f2",
      pitfallBorder: "#fca5a5",
    },
    typography: {
      fontFamily: "Georgia, serif",
      headingWeight: "600",
      bodyWeight: "400",
    },
    spacing: {
      cardPadding: "1.25rem",
      sectionGap: "2.5rem",
      componentGap: "1.25rem",
    },
    borderRadius: "1rem",
  },
  cool: {
    name: "cool",
    colors: {
      background: "#f0f9ff",
      surface: "#f8fafc",
      surfaceHover: "#f1f5f9",
      border: "#cbd5e1",
      borderAccent: "#94a3b8",
      textPrimary: "#0f172a",
      textSecondary: "#334155",
      textMuted: "#64748b",
      textAccent: "#0369a1",
      accent: "#0369a1",
      accentLight: "#e0f2fe",
      accentDark: "#075985",
      success: "#047857",
      successLight: "#d1fae5",
      warning: "#b45309",
      warningLight: "#fef3c7",
      error: "#b91c1c",
      errorLight: "#fee2e2",
      info: "#0369a1",
      infoLight: "#e0f2fe",
      insightBg: "#f0f9ff",
      insightBorder: "#38bdf8",
      takeawayBg: "#ecfdf5",
      takeawayBorder: "#6ee7b7",
      tradeoffBg: "#fefce8",
      tradeoffBorder: "#fde047",
      mentalModelBg: "#f5f3ff",
      mentalModelBorder: "#a78bfa",
      questionBg: "#e0f2fe",
      questionBorder: "#0ea5e9",
      consensusBg: "#d1fae5",
      consensusBorder: "#34d399",
      debateBg: "#fce7f3",
      debateBorder: "#f472b6",
      pitfallBg: "#fef2f2",
      pitfallBorder: "#f87171",
    },
    typography: {
      fontFamily: "Inter, system-ui, sans-serif",
      headingWeight: "600",
      bodyWeight: "400",
    },
    spacing: {
      cardPadding: "1rem",
      sectionGap: "2rem",
      componentGap: "0.875rem",
    },
    borderRadius: "0.5rem",
  },
  mono: {
    name: "mono",
    colors: {
      background: "#fafafa",
      surface: "#ffffff",
      surfaceHover: "#f4f4f5",
      border: "#d4d4d8",
      borderAccent: "#a1a1aa",
      textPrimary: "#09090b",
      textSecondary: "#27272a",
      textMuted: "#71717a",
      textAccent: "#27272a",
      accent: "#27272a",
      accentLight: "#f4f4f5",
      accentDark: "#09090b",
      success: "#27272a",
      successLight: "#f4f4f5",
      warning: "#52525b",
      warningLight: "#e4e4e7",
      error: "#09090b",
      errorLight: "#f4f4f5",
      info: "#3f3f46",
      infoLight: "#e4e4e7",
      insightBg: "#fafafa",
      insightBorder: "#a1a1aa",
      takeawayBg: "#f4f4f5",
      takeawayBorder: "#71717a",
      tradeoffBg: "#e4e4e7",
      tradeoffBorder: "#52525b",
      mentalModelBg: "#f4f4f5",
      mentalModelBorder: "#a1a1aa",
      questionBg: "#e4e4e7",
      questionBorder: "#71717a",
      consensusBg: "#f4f4f5",
      consensusBorder: "#a1a1aa",
      debateBg: "#e4e4e7",
      debateBorder: "#71717a",
      pitfallBg: "#fafafa",
      pitfallBorder: "#52525b",
    },
    typography: {
      fontFamily: "JetBrains Mono, Menlo, monospace",
      headingWeight: "600",
      bodyWeight: "400",
    },
    spacing: {
      cardPadding: "1rem",
      sectionGap: "1.5rem",
      componentGap: "0.75rem",
    },
    borderRadius: "0.25rem",
  },
  vibrant: {
    name: "vibrant",
    colors: {
      background: "#faf5ff",
      surface: "#ffffff",
      surfaceHover: "#fdf4ff",
      border: "#e9d5ff",
      borderAccent: "#d8b4fe",
      textPrimary: "#1e1b4b",
      textSecondary: "#3730a3",
      textMuted: "#6366f1",
      textAccent: "#7c3aed",
      accent: "#7c3aed",
      accentLight: "#ede9fe",
      accentDark: "#5b21b6",
      success: "#059669",
      successLight: "#d1fae5",
      warning: "#d97706",
      warningLight: "#fef3c7",
      error: "#dc2626",
      errorLight: "#fee2e2",
      info: "#2563eb",
      infoLight: "#dbeafe",
      insightBg: "#fdf4ff",
      insightBorder: "#e879f9",
      takeawayBg: "#ecfdf5",
      takeawayBorder: "#34d399",
      tradeoffBg: "#fffbeb",
      tradeoffBorder: "#fbbf24",
      mentalModelBg: "#ede9fe",
      mentalModelBorder: "#8b5cf6",
      questionBg: "#e0f2fe",
      questionBorder: "#38bdf8",
      consensusBg: "#d1fae5",
      consensusBorder: "#10b981",
      debateBg: "#fce7f3",
      debateBorder: "#ec4899",
      pitfallBg: "#fee2e2",
      pitfallBorder: "#ef4444",
    },
    typography: {
      fontFamily: "Poppins, system-ui, sans-serif",
      headingWeight: "700",
      bodyWeight: "400",
    },
    spacing: {
      cardPadding: "1.25rem",
      sectionGap: "2.5rem",
      componentGap: "1.25rem",
    },
    borderRadius: "1rem",
  },
};

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a SynthesisThemeProvider");
  }
  return context;
}

interface SynthesisThemeProviderProps {
  themeName: ThemeName;
  children: ReactNode;
}

export function SynthesisThemeProvider({
  themeName,
  children,
}: SynthesisThemeProviderProps) {
  const value = useMemo<ThemeContextValue>(() => {
    const theme = themes[themeName];
    return {
      theme,
      themeName,
      colors: theme.colors,
    };
  }, [themeName]);

  const style = useMemo(() => {
    const theme = themes[themeName];
    return {
      fontFamily: theme.typography.fontFamily,
      "--synth-radius": theme.borderRadius,
      "--synth-spacing-card": theme.spacing.cardPadding,
      "--synth-spacing-section": theme.spacing.sectionGap,
      "--synth-spacing-component": theme.spacing.componentGap,
    } as React.CSSProperties;
  }, [themeName]);

  return (
    <ThemeContext.Provider value={value}>
      <div style={style}>{children}</div>
    </ThemeContext.Provider>
  );
}
