import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Target,
  Scale,
  Brain,
  HelpCircle,
  Users,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
  BookOpen,
  Zap,
} from "lucide-react";
import { useTheme } from "../ThemeProvider";
import { SourcePill } from "./SourcePill";
import type { InsightCard as InsightCardType, InsightCardVariant } from "@rag-bookmarks/shared";

type VariantStyle = "featured" | "contrarian" | "question" | "standard";

const variantConfig: Record<InsightCardVariant, {
  icon: typeof Lightbulb;
  label: string;
  accentColor: string;
  style: VariantStyle;
}> = {
  key_insight: { icon: Lightbulb, label: "Key Insight", accentColor: "#fbbf24", style: "featured" },
  practical_takeaway: { icon: Target, label: "Actionable", accentColor: "#34d399", style: "standard" },
  tradeoff: { icon: Scale, label: "Tradeoff", accentColor: "#fbbf24", style: "contrarian" },
  mental_model: { icon: Brain, label: "Mental Model", accentColor: "#a78bfa", style: "standard" },
  open_question: { icon: HelpCircle, label: "Open Question", accentColor: "#60a5fa", style: "question" },
  consensus: { icon: Users, label: "Consensus", accentColor: "#34d399", style: "featured" },
  debate: { icon: MessageSquare, label: "Sources Disagree", accentColor: "#f472b6", style: "contrarian" },
  pitfall: { icon: AlertTriangle, label: "Watch Out", accentColor: "#f87171", style: "standard" },
};

interface InsightCardProps {
  data: InsightCardType;
  index?: number;
}

export function InsightCard({ data, index = 0 }: InsightCardProps) {
  const { colors, theme } = useTheme();
  const config = variantConfig[data.variant];
  const [showDetails, setShowDetails] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const hasDetails = data.whyItMatters || data.howToApply;
  const hasSources = data.sources && data.sources.length > 0;

  // Render based on variant style
  if (config.style === "featured") {
    return <FeaturedInsight data={data} config={config} index={index} />;
  }

  if (config.style === "contrarian") {
    return <ContrarianInsight data={data} config={config} index={index} />;
  }

  if (config.style === "question") {
    return <QuestionInsight data={data} config={config} index={index} />;
  }

  // Standard compact style
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
      }}
      className="relative overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      {/* Colored accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: config.accentColor }}
      />

      <div className="pl-5 pr-5 py-5">
        {/* Header with variant badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3
            style={{ color: colors.textPrimary }}
            className="text-lg font-semibold leading-snug flex-1"
          >
            {data.title}
          </h3>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0"
            style={{
              backgroundColor: `${config.accentColor}20`,
              color: config.accentColor,
            }}
          >
            <config.icon className="h-3 w-3" />
            {config.label}
          </span>
        </div>

        {/* Content */}
        <p
          style={{ color: colors.textSecondary }}
          className="text-sm leading-relaxed"
        >
          {data.content}
        </p>

        {/* Expandable details */}
        {hasDetails && (
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: colors.textMuted }}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
              />
              {showDetails ? "Hide details" : "Why this matters"}
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    {data.whyItMatters && (
                      <div
                        className="pl-3 border-l-2 text-sm"
                        style={{ borderColor: colors.border, color: colors.textSecondary }}
                      >
                        <span className="font-medium" style={{ color: colors.textMuted }}>
                          Why it matters:
                        </span>{" "}
                        {data.whyItMatters}
                      </div>
                    )}
                    {data.howToApply && (
                      <div
                        className="pl-3 border-l-2 text-sm"
                        style={{ borderColor: colors.border, color: colors.textSecondary }}
                      >
                        <span className="font-medium" style={{ color: colors.textMuted }}>
                          How to apply:
                        </span>{" "}
                        {data.howToApply}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Sources - click to expand */}
        {hasSources && (
          <div className="mt-4 pt-3 border-t" style={{ borderColor: colors.border }}>
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-2 text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: colors.textMuted }}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>{data.sources!.length} source{data.sources!.length !== 1 ? "s" : ""}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${showSources ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 flex flex-wrap gap-2">
                    {data.sources!.map((source) => (
                      <SourcePill
                        key={source.bookmarkId}
                        title={source.title}
                        url={source.url}
                        bookmarkId={source.bookmarkId}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Featured variant - large, drop-cap style for key_insight and consensus
function FeaturedInsight({
  data,
  config,
  index = 0,
}: {
  data: InsightCardType;
  config: typeof variantConfig[InsightCardVariant];
  index?: number;
}) {
  const { colors, theme } = useTheme();
  const [showSources, setShowSources] = useState(false);
  const hasSources = data.sources && data.sources.length > 0;

  // Get first letter for drop cap
  const firstLetter = data.content.charAt(0);
  const restOfContent = data.content.slice(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
      }}
      className="relative overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300"
    >
      {/* Gradient accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{
          background: `linear-gradient(180deg, ${config.accentColor} 0%, ${config.accentColor}80 100%)`,
        }}
      />

      <div className="pl-7 pr-6 py-6">
        {/* Badge */}
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4"
          style={{
            backgroundColor: `${config.accentColor}20`,
            color: config.accentColor,
          }}
        >
          <config.icon className="h-3.5 w-3.5" />
          {config.label}
        </span>

        {/* Title - larger */}
        <h3
          style={{ color: colors.textPrimary }}
          className="text-xl font-bold leading-snug mb-4"
        >
          {data.title}
        </h3>

        {/* Content with drop cap */}
        <p
          style={{ color: colors.textSecondary }}
          className="text-base leading-relaxed"
        >
          <span
            className="float-left text-5xl font-bold leading-none pr-2 pt-1"
            style={{ color: config.accentColor }}
          >
            {firstLetter}
          </span>
          {restOfContent}
        </p>

        {/* Why it matters - inline for featured */}
        {data.whyItMatters && (
          <div
            className="mt-6 p-4 rounded-lg"
            style={{ backgroundColor: `${config.accentColor}10` }}
          >
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              <span className="font-semibold" style={{ color: colors.textPrimary }}>
                Why this matters:
              </span>{" "}
              {data.whyItMatters}
            </p>
          </div>
        )}

        {/* Explore sources CTA */}
        {hasSources && (
          <div className="mt-6">
            <button
              onClick={() => setShowSources(!showSources)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-sm"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.textSecondary,
              }}
            >
              <BookOpen className="h-4 w-4" />
              Explore {data.sources!.length} source{data.sources!.length !== 1 ? "s" : ""} →
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 flex flex-wrap gap-2">
                    {data.sources!.map((source) => (
                      <SourcePill
                        key={source.bookmarkId}
                        title={source.title}
                        url={source.url}
                        bookmarkId={source.bookmarkId}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Contrarian variant - for debate and tradeoff
function ContrarianInsight({
  data,
  config,
  index = 0,
}: {
  data: InsightCardType;
  config: typeof variantConfig[InsightCardVariant];
  index?: number;
}) {
  const { colors, theme } = useTheme();
  const [showSources, setShowSources] = useState(false);
  const hasSources = data.sources && data.sources.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.borderRadius,
        border: `1px dashed ${config.accentColor}50`,
      }}
      className="relative overflow-hidden"
    >
      <div className="px-5 py-5">
        {/* Attention-grabbing header */}
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4" style={{ color: config.accentColor }} />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: config.accentColor }}
          >
            {config.label}
          </span>
        </div>

        {/* Title - italic, intriguing */}
        <h3
          style={{ color: colors.textPrimary }}
          className="text-lg font-medium italic leading-snug mb-3"
        >
          "{data.title}"
        </h3>

        {/* Content */}
        <p
          style={{ color: colors.textSecondary }}
          className="text-sm leading-relaxed"
        >
          {data.content}
        </p>

        {/* CTA to explore the debate */}
        {hasSources && (
          <button
            onClick={() => setShowSources(!showSources)}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-colors"
            style={{ color: config.accentColor }}
          >
            See the debate →
          </button>
        )}

        <AnimatePresence>
          {showSources && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 flex flex-wrap gap-2">
                {data.sources!.map((source) => (
                  <SourcePill
                    key={source.bookmarkId}
                    title={source.title}
                    url={source.url}
                    bookmarkId={source.bookmarkId}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Question variant - provocative, inviting exploration
function QuestionInsight({
  data,
  config,
  index = 0,
}: {
  data: InsightCardType;
  config: typeof variantConfig[InsightCardVariant];
  index?: number;
}) {
  const { colors, theme } = useTheme();
  const [showSources, setShowSources] = useState(false);
  const hasSources = data.sources && data.sources.length > 0;

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
      <div
        className="absolute -right-6 -bottom-6 text-[100px] font-serif leading-none select-none pointer-events-none"
        style={{ color: config.accentColor, opacity: 0.08 }}
      >
        ?
      </div>

      <div className="relative px-6 py-6">
        {/* Label */}
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="h-4 w-4" style={{ color: config.accentColor }} />
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: config.accentColor }}
          >
            {config.label}
          </span>
        </div>

        {/* Question - large italic */}
        <h3
          style={{ color: colors.textPrimary }}
          className="text-xl font-medium italic leading-snug mb-3"
        >
          {data.title}
        </h3>

        {/* Context */}
        <p
          style={{ color: colors.textMuted }}
          className="text-sm leading-relaxed"
        >
          {data.content}
        </p>

        {/* Explore sources */}
        {hasSources && (
          <button
            onClick={() => setShowSources(!showSources)}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: config.accentColor }}
          >
            <BookOpen className="h-4 w-4" />
            What sources say →
          </button>
        )}

        <AnimatePresence>
          {showSources && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 flex flex-wrap gap-2">
                {data.sources!.map((source) => (
                  <SourcePill
                    key={source.bookmarkId}
                    title={source.title}
                    url={source.url}
                    bookmarkId={source.bookmarkId}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
