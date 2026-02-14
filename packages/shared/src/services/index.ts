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
