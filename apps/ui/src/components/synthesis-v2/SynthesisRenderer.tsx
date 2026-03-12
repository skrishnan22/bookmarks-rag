import type { ComponentSpec, ThemeName } from "@rag-bookmarks/shared";
import { SynthesisThemeProvider, useTheme } from "./ThemeProvider";
import { SynthesisContainer } from "./components/SynthesisContainer";
import { SectionHeader } from "./components/SectionHeader";
import { InsightCard } from "./components/InsightCard";
import { ComparisonGrid } from "./components/ComparisonGrid";
import { ProcessFlow } from "./components/ProcessFlow";
import { Timeline } from "./components/Timeline";
import { SourceCluster } from "./components/SourceCluster";
import { DeepDiveLink } from "./components/DeepDiveLink";
import { KeyTakeaway } from "./components/KeyTakeaway";
import { NarrativeBlock } from "./components/NarrativeBlock";
import { BulletList } from "./components/BulletList";
import { QuoteBlock } from "./components/QuoteBlock";
import { WarningCallout, TipCallout, QuestionCallout } from "./components/Callouts";
import { Divider, OrnamentalDivider } from "./components/Divider";
import { HeroBlock } from "./components/HeroBlock";
import { DebateBlock } from "./components/DebateBlock";
import { StatCallout } from "./components/StatCallout";
import { ReadingPath } from "./components/ReadingPath";

interface SynthesisRendererProps {
  components: ComponentSpec[];
  theme?: ThemeName;
  className?: string;
}

/**
 * Main renderer that maps component specs to React components.
 * Uses a weight-based grid layout for visual hierarchy.
 */
export function SynthesisRenderer({
  components,
  theme = "default",
  className = "",
}: SynthesisRendererProps) {
  return (
    <SynthesisThemeProvider themeName={theme}>
      <SynthesisContent components={components} className={className} />
    </SynthesisThemeProvider>
  );
}

/**
 * Get the visual weight of a component.
 * Components with an explicit weight field use it; others default based on type.
 */
function getComponentWeight(spec: ComponentSpec): string {
  // Check if the spec has an explicit weight field
  if ("weight" in spec && spec.weight) {
    return spec.weight;
  }

  // Default weights based on type
  switch (spec.type) {
    case "HeroBlock":
      return "hero";
    case "DebateBlock":
    case "ComparisonGrid":
    case "ReadingPath":
      return "full";
    case "StatCallout":
      return "supporting";
    case "SynthesisContainer":
    case "SectionHeader":
    case "Divider":
    case "ProcessFlow":
    case "Timeline":
      return "full"; // always full width, but not "hero" sized
    default:
      return "supporting";
  }
}

/**
 * Map weight to grid column span classes (6-column grid).
 * Biased toward full-width to avoid cramped layouts.
 */
function weightToGridClass(weight: string): string {
  switch (weight) {
    case "hero":
      return "col-span-6";
    case "prominent":
      return "col-span-6";
    case "supporting":
      return "col-span-6 md:col-span-3";
    case "aside":
      return "col-span-6 md:col-span-3";
    case "full":
      return "col-span-6";
    default:
      return "col-span-6 md:col-span-3";
  }
}

interface SynthesisContentProps {
  components: ComponentSpec[];
  className: string;
}

function SynthesisContent({ components, className }: SynthesisContentProps) {
  const { colors } = useTheme();

  let sectionNumber = 0;
  let isFirstNarrative = true;

  return (
    <div className={`grid grid-cols-6 gap-5 ${className}`}>
      {components.map((spec, index) => {
        const isSectionHeader = spec.type === "SectionHeader";
        const needsOrnamentalDivider = isSectionHeader && index > 0;

        if (isSectionHeader) {
          sectionNumber++;
        }

        const isFirstNarrativeBlock = spec.type === "NarrativeBlock" && isFirstNarrative;
        if (spec.type === "NarrativeBlock") {
          isFirstNarrative = false;
        }

        const weight = getComponentWeight(spec);
        const gridClass = weightToGridClass(weight);

        return (
          <div key={spec.id} className={gridClass}>
            {needsOrnamentalDivider && <OrnamentalDivider />}
            <ComponentRenderer
              spec={spec}
              index={index}
              sectionNumber={isSectionHeader ? sectionNumber : undefined}
              isFirstNarrative={isFirstNarrativeBlock}
            />
          </div>
        );
      })}
    </div>
  );
}

interface ComponentRendererProps {
  spec: ComponentSpec;
  index: number;
  sectionNumber?: number;
  isFirstNarrative?: boolean;
}

function ComponentRenderer({
  spec,
  index,
  sectionNumber,
  isFirstNarrative,
}: ComponentRendererProps) {
  switch (spec.type) {
    case "SynthesisContainer":
      return <SynthesisContainer data={spec} index={index} />;

    case "SectionHeader":
      return <SectionHeader data={spec} index={index} sectionNumber={sectionNumber} />;

    case "InsightCard":
      return <InsightCard data={spec} index={index} />;

    case "ComparisonGrid":
      return <ComparisonGrid data={spec} index={index} />;

    case "ProcessFlow":
      return <ProcessFlow data={spec} index={index} />;

    case "Timeline":
      return <Timeline data={spec} index={index} />;

    case "SourceCluster":
      return <SourceCluster data={spec} index={index} />;

    case "DeepDiveLink":
      return <DeepDiveLink data={spec} index={index} />;

    case "KeyTakeaway":
      return <KeyTakeaway data={spec} index={index} />;

    case "NarrativeBlock":
      return <NarrativeBlock data={spec} index={index} isFirst={isFirstNarrative} />;

    case "BulletList":
      return <BulletList data={spec} index={index} />;

    case "QuoteBlock":
      return <QuoteBlock data={spec} index={index} />;

    case "WarningCallout":
      return <WarningCallout data={spec} index={index} />;

    case "TipCallout":
      return <TipCallout data={spec} index={index} />;

    case "QuestionCallout":
      return <QuestionCallout data={spec} index={index} />;

    case "Divider":
      return <Divider data={spec} />;

    case "HeroBlock":
      return <HeroBlock data={spec} index={index} />;

    case "DebateBlock":
      return <DebateBlock data={spec} index={index} />;

    case "StatCallout":
      return <StatCallout data={spec} index={index} />;

    case "ReadingPath":
      return <ReadingPath data={spec} index={index} />;

    // Layout components not yet implemented
    case "Section":
    case "TwoColumn":
    case "TopicTitle":
    case "ConceptCard":
    case "SourceCard":
    case "VsBlock":
    case "SourceChip":
    case "VisualPlaceholder":
      return (
        <div className="p-3 bg-gray-100 rounded text-xs text-gray-500">
          Component "{spec.type}" not yet implemented
        </div>
      );

    default:
      const _exhaustiveCheck: never = spec;
      return null;
  }
}

export { SynthesisThemeProvider } from "./ThemeProvider";
