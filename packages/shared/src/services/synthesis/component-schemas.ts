import { z } from "zod";

// ============================================================================
// Base Types
// ============================================================================

export const SourceReferenceSchema = z.object({
  bookmarkId: z.string(),
  title: z.string(),
  url: z.string(),
  snippet: z.string().optional(),
});

export type SourceReference = z.infer<typeof SourceReferenceSchema>;

// ============================================================================
// Visual Weight — controls layout prominence in the grid
// ============================================================================

export const ComponentWeightSchema = z.enum(["hero", "prominent", "supporting", "aside"]).optional();

// ============================================================================
// Layout Components
// ============================================================================

export const SynthesisContainerSchema = z.object({
  type: z.literal("SynthesisContainer"),
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  theme: z.enum(["default", "warm", "cool", "mono", "vibrant"]).default("default"),
});

export const SectionSchema = z.object({
  type: z.literal("Section"),
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export const TwoColumnSchema = z.object({
  type: z.literal("TwoColumn"),
  id: z.string(),
  leftTitle: z.string().optional(),
  rightTitle: z.string().optional(),
});

export const DividerSchema = z.object({
  type: z.literal("Divider"),
  id: z.string(),
  style: z.enum(["solid", "dashed", "dotted", "gradient"]).default("solid"),
});

// ============================================================================
// Header Components
// ============================================================================

export const SectionHeaderSchema = z.object({
  type: z.literal("SectionHeader"),
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  icon: z.enum([
    "lightbulb",
    "target",
    "puzzle",
    "chart",
    "book",
    "star",
    "warning",
    "question",
    "check",
    "arrow",
  ]).optional(),
});

export const TopicTitleSchema = z.object({
  type: z.literal("TopicTitle"),
  id: z.string(),
  title: z.string(),
  level: z.enum(["h1", "h2", "h3"]).default("h2"),
});

// ============================================================================
// Card Components
// ============================================================================

export const InsightCardVariantSchema = z.enum([
  "key_insight",
  "practical_takeaway",
  "tradeoff",
  "mental_model",
  "open_question",
  "consensus",
  "debate",
  "pitfall",
]);

export const InsightCardSchema = z.object({
  type: z.literal("InsightCard"),
  id: z.string(),
  weight: ComponentWeightSchema,
  variant: InsightCardVariantSchema,
  title: z.string(),
  content: z.string(),
  whyItMatters: z.string().optional(),
  howToApply: z.string().optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const ConceptCardSchema = z.object({
  type: z.literal("ConceptCard"),
  id: z.string(),
  term: z.string(),
  definition: z.string(),
  examples: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const SourceCardSchema = z.object({
  type: z.literal("SourceCard"),
  id: z.string(),
  bookmarkId: z.string(),
  title: z.string(),
  url: z.string(),
  summary: z.string(),
  relevance: z.string().optional(),
  keyQuotes: z.array(z.string()).optional(),
});

// ============================================================================
// Callout Components
// ============================================================================

export const QuestionCalloutSchema = z.object({
  type: z.literal("QuestionCallout"),
  id: z.string(),
  question: z.string(),
  context: z.string().optional(),
  relatedSources: z.array(SourceReferenceSchema).optional(),
});

export const WarningCalloutSchema = z.object({
  type: z.literal("WarningCallout"),
  id: z.string(),
  title: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]).default("warning"),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const TipCalloutSchema = z.object({
  type: z.literal("TipCallout"),
  id: z.string(),
  title: z.string().optional(),
  tip: z.string(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const KeyTakeawaySchema = z.object({
  type: z.literal("KeyTakeaway"),
  id: z.string(),
  takeaway: z.string(),
  explanation: z.string().optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

// ============================================================================
// Comparison Components
// ============================================================================

export const ComparisonItemSchema = z.object({
  label: z.string(),
  points: z.array(z.string()),
});

export const ComparisonGridSchema = z.object({
  type: z.literal("ComparisonGrid"),
  id: z.string(),
  weight: ComponentWeightSchema,
  title: z.string().optional(),
  left: ComparisonItemSchema,
  right: ComparisonItemSchema,
  sources: z.array(SourceReferenceSchema).optional(),
});

export const VsBlockSchema = z.object({
  type: z.literal("VsBlock"),
  id: z.string(),
  optionA: z.object({
    name: z.string(),
    description: z.string(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  }),
  optionB: z.object({
    name: z.string(),
    description: z.string(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  }),
  verdict: z.string().optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

// ============================================================================
// Flow Components
// ============================================================================

export const ProcessStepSchema = z.object({
  number: z.number(),
  title: z.string(),
  description: z.string(),
  tips: z.array(z.string()).optional(),
});

export const ProcessFlowSchema = z.object({
  type: z.literal("ProcessFlow"),
  id: z.string(),
  title: z.string().optional(),
  steps: z.array(ProcessStepSchema),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const TimelineEventSchema = z.object({
  date: z.string(),
  title: z.string(),
  description: z.string(),
  significance: z.string().optional(),
});

export const TimelineSchema = z.object({
  type: z.literal("Timeline"),
  id: z.string(),
  title: z.string().optional(),
  events: z.array(TimelineEventSchema),
  sources: z.array(SourceReferenceSchema).optional(),
});

// ============================================================================
// Source Components
// ============================================================================

export const SourceChipSchema = z.object({
  type: z.literal("SourceChip"),
  id: z.string(),
  bookmarkId: z.string(),
  title: z.string(),
  url: z.string(),
  index: z.number().optional(),
});

export const SourceClusterSchema = z.object({
  type: z.literal("SourceCluster"),
  id: z.string(),
  label: z.string().optional(),
  sources: z.array(z.object({
    bookmarkId: z.string(),
    title: z.string(),
    url: z.string(),
  })),
});

export const DeepDiveLinkSchema = z.object({
  type: z.literal("DeepDiveLink"),
  id: z.string(),
  bookmarkId: z.string(),
  title: z.string(),
  url: z.string(),
  reason: z.string(),
});

// ============================================================================
// Hero Components — full-width, high-impact visual blocks
// ============================================================================

export const HeroBlockSchema = z.object({
  type: z.literal("HeroBlock"),
  id: z.string(),
  weight: ComponentWeightSchema,
  headline: z.string(),
  subtext: z.string(),
  visual: z.enum(["none", "stat", "svg", "quote"]).default("none"),
  stat: z.object({
    value: z.string(),
    label: z.string(),
  }).optional(),
  svgContent: z.string().optional(),
  quote: z.object({
    text: z.string(),
    attribution: z.string().optional(),
  }).optional(),
});

export const DebateBlockSchema = z.object({
  type: z.literal("DebateBlock"),
  id: z.string(),
  weight: ComponentWeightSchema,
  tension: z.string(),
  sideA: z.object({
    quote: z.string(),
    source: SourceReferenceSchema,
    position: z.string(),
  }),
  sideB: z.object({
    quote: z.string(),
    source: SourceReferenceSchema,
    position: z.string(),
  }),
  synthesis: z.string().optional(),
});

export const StatCalloutSchema = z.object({
  type: z.literal("StatCallout"),
  id: z.string(),
  weight: ComponentWeightSchema,
  value: z.string(),
  label: z.string(),
  context: z.string().optional(),
});

export const ReadingPathSchema = z.object({
  type: z.literal("ReadingPath"),
  id: z.string(),
  weight: ComponentWeightSchema,
  title: z.string(),
  steps: z.array(z.object({
    source: SourceReferenceSchema,
    reason: z.string(),
  })),
});

// ============================================================================
// Visual Components
// ============================================================================

export const VisualPlaceholderSchema = z.object({
  type: z.literal("VisualPlaceholder"),
  id: z.string(),
  visualType: z.enum(["diagram", "chart", "illustration", "icon"]),
  prompt: z.string(),
  fallbackText: z.string(),
  svgContent: z.string().optional(),
});

// ============================================================================
// Text Components
// ============================================================================

export const NarrativeBlockSchema = z.object({
  type: z.literal("NarrativeBlock"),
  id: z.string(),
  weight: ComponentWeightSchema,
  content: z.string(),
  citations: z.array(z.object({
    index: z.number(),
    bookmarkId: z.string(),
  })).optional(),
});

export const BulletListSchema = z.object({
  type: z.literal("BulletList"),
  id: z.string(),
  title: z.string().optional(),
  items: z.array(z.string()),
  ordered: z.boolean().default(false),
});

export const QuoteBlockSchema = z.object({
  type: z.literal("QuoteBlock"),
  id: z.string(),
  weight: ComponentWeightSchema,
  quote: z.string(),
  attribution: z.string().optional(),
  source: SourceReferenceSchema.optional(),
});

// ============================================================================
// Discriminated Union - All Component Types
// ============================================================================

export const ComponentSpecSchema = z.discriminatedUnion("type", [
  // Layout
  SynthesisContainerSchema,
  SectionSchema,
  TwoColumnSchema,
  DividerSchema,
  // Headers
  SectionHeaderSchema,
  TopicTitleSchema,
  // Cards
  InsightCardSchema,
  ConceptCardSchema,
  SourceCardSchema,
  // Callouts
  QuestionCalloutSchema,
  WarningCalloutSchema,
  TipCalloutSchema,
  KeyTakeawaySchema,
  // Comparison
  ComparisonGridSchema,
  VsBlockSchema,
  // Flow
  ProcessFlowSchema,
  TimelineSchema,
  // Sources
  SourceChipSchema,
  SourceClusterSchema,
  DeepDiveLinkSchema,
  // Visual
  VisualPlaceholderSchema,
  // Text
  NarrativeBlockSchema,
  BulletListSchema,
  QuoteBlockSchema,
  // Hero / High-impact
  HeroBlockSchema,
  DebateBlockSchema,
  StatCalloutSchema,
  ReadingPathSchema,
]);

export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;
export type ComponentType = ComponentSpec["type"];

// Individual type exports
export type SynthesisContainer = z.infer<typeof SynthesisContainerSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type TwoColumn = z.infer<typeof TwoColumnSchema>;
export type Divider = z.infer<typeof DividerSchema>;
export type SectionHeader = z.infer<typeof SectionHeaderSchema>;
export type TopicTitle = z.infer<typeof TopicTitleSchema>;
export type InsightCard = z.infer<typeof InsightCardSchema>;
export type InsightCardVariant = z.infer<typeof InsightCardVariantSchema>;
export type ConceptCard = z.infer<typeof ConceptCardSchema>;
export type SourceCard = z.infer<typeof SourceCardSchema>;
export type QuestionCallout = z.infer<typeof QuestionCalloutSchema>;
export type WarningCallout = z.infer<typeof WarningCalloutSchema>;
export type TipCallout = z.infer<typeof TipCalloutSchema>;
export type KeyTakeaway = z.infer<typeof KeyTakeawaySchema>;
export type ComparisonGrid = z.infer<typeof ComparisonGridSchema>;
export type VsBlock = z.infer<typeof VsBlockSchema>;
export type ProcessFlow = z.infer<typeof ProcessFlowSchema>;
export type ProcessStep = z.infer<typeof ProcessStepSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type SourceChip = z.infer<typeof SourceChipSchema>;
export type SourceCluster = z.infer<typeof SourceClusterSchema>;
export type DeepDiveLink = z.infer<typeof DeepDiveLinkSchema>;
export type VisualPlaceholder = z.infer<typeof VisualPlaceholderSchema>;
export type NarrativeBlock = z.infer<typeof NarrativeBlockSchema>;
export type BulletList = z.infer<typeof BulletListSchema>;
export type QuoteBlock = z.infer<typeof QuoteBlockSchema>;
export type HeroBlock = z.infer<typeof HeroBlockSchema>;
export type DebateBlock = z.infer<typeof DebateBlockSchema>;
export type StatCallout = z.infer<typeof StatCalloutSchema>;
export type ReadingPath = z.infer<typeof ReadingPathSchema>;
export type ComponentWeight = z.infer<typeof ComponentWeightSchema>;

// ============================================================================
// Synthesis V2 Result Schema
// ============================================================================

export const SynthesisV2ResultSchema = z.object({
  version: z.literal(2),
  query: z.string(),
  theme: z.enum(["default", "warm", "cool", "mono", "vibrant"]).default("default"),
  components: z.array(ComponentSpecSchema),
  citationIndex: z.array(z.object({
    index: z.number().int().min(1),
    bookmarkId: z.string(),
    title: z.string(),
    url: z.string(),
  })),
  metadata: z.object({
    bookmarkCount: z.number(),
    componentCount: z.number(),
    generatedAt: z.string(),
  }),
});

export type SynthesisV2Result = z.infer<typeof SynthesisV2ResultSchema>;

// Helper to validate a single component
export function validateComponent(data: unknown): ComponentSpec {
  return ComponentSpecSchema.parse(data);
}

// Helper to validate array of components
export function validateComponents(data: unknown[]): ComponentSpec[] {
  return data.map((item) => ComponentSpecSchema.parse(item));
}
