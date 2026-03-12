export * from "./html-to-markdown.js";
export * from "./summary.js";
export * from "./chunking.js";
export * from "./embedding.js";
export { extractEntities } from "./entity-extraction.js";
export type { ExtractedEntity as ExtractedEntity } from "./entity-extraction.js";
export { EntityEnrichmentService } from "./entity-enrichment.js";
export { extractSummaryAndEntities } from "./content-extraction.js";
export type { ExtractedEntity as ContentExtractedEntity } from "./content-extraction.js";
export type { ContentExtractionResult } from "./content-extraction.js";

// Image inventory and heuristics
export {
  extractImageInventory,
  extractImagesFromMarkdown,
  extractDomain,
  type ExtractedImage,
  type RequestImage,
  type ImageInventoryInput,
} from "./image-inventory.js";

export {
  calculateHeuristicScore,
  type HeuristicResult,
  type HeuristicContext,
} from "./image-heuristics.js";

export {
  extractEntitiesFromImage,
  type ImageExtractionContext,
} from "./image-entity-extraction.js";

export { mergeImageEntities } from "./entity-merge.js";

// Synthesis pipeline
export { runSynthesisPipeline } from "./synthesis/orchestrator.js";
export type {
  SynthesisResult,
  SynthesisSection,
  SynthesisCitation,
  DeepDive,
  BatchExtractionResult,
} from "./synthesis/types.js";
export { extractInsightsFromBatch } from "./synthesis/map-extractor.js";
export { synthesizeFromExtractions } from "./synthesis/reducer.js";

// Excalidraw generator
export {
  generateExcalidrawJson,
  type ExcalidrawFile,
} from "./excalidraw/generator.js";

// Synthesis V2 - Component-based rendering
export {
  ComponentSpecSchema,
  SynthesisV2ResultSchema,
  validateComponent,
  validateComponents,
  type ComponentSpec,
  type ComponentType,
  type SynthesisV2Result,
  type SynthesisContainer,
  type Section,
  type TwoColumn,
  type Divider,
  type SectionHeader,
  type TopicTitle,
  type InsightCard,
  type InsightCardVariant,
  type ConceptCard,
  type SourceCard,
  type QuestionCallout,
  type WarningCallout,
  type TipCallout,
  type KeyTakeaway,
  type ComparisonGrid,
  type VsBlock,
  type ProcessFlow,
  type ProcessStep,
  type Timeline,
  type TimelineEvent,
  type SourceChip,
  type SourceCluster,
  type DeepDiveLink,
  type VisualPlaceholder,
  type NarrativeBlock,
  type BulletList,
  type QuoteBlock,
  type SourceReference,
  type HeroBlock,
  type DebateBlock,
  type StatCallout,
  type ReadingPath,
  type ComponentWeight,
} from "./synthesis/component-schemas.js";

export {
  ThemeNameSchema,
  getTheme,
  getThemeColors,
  themeToCssVars,
  themes,
  type ThemeName,
  type Theme,
  type ThemeColors,
} from "./synthesis/theme.js";

export {
  runRenderPhase,
  buildSynthesisV2Result,
  generateFallbackComponents,
  type RenderPhaseOptions,
  type RenderPhaseResult,
} from "./synthesis/render-orchestrator.js";

export {
  StreamingComponentParser,
  parseComponentArray,
  extractJsonArray,
} from "./synthesis/streaming-parser.js";

export {
  buildRenderSystemPrompt,
  buildRenderUserPrompt,
  buildSimpleRenderPrompt,
} from "./synthesis/render-prompt.js";
