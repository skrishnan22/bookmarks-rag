import type { LLMProvider } from "../../providers/types.js";
import type { SynthesisResult } from "./types.js";
import type { ComponentSpec, SynthesisV2Result } from "./component-schemas.js";
import type { ThemeName } from "./theme.js";
import {
  buildRenderSystemPrompt,
  buildSimpleRenderPrompt,
} from "./render-prompt.js";
import {
  parseComponentArray,
  extractJsonArray,
} from "./streaming-parser.js";

export interface RenderPhaseOptions {
  llmProvider: LLMProvider;
  theme?: ThemeName;
  onComponents?: (components: ComponentSpec[]) => Promise<void> | void;
  onProgress?: (current: number, total: number) => void;
}

export interface RenderPhaseResult {
  components: ComponentSpec[];
  theme: ThemeName;
}

/**
 * Run the render phase to transform synthesis results into visual components.
 *
 * This phase takes the synthesis result and generates a stream of component
 * specifications that can be rendered by the UI.
 */
export async function runRenderPhase(
  synthesis: SynthesisResult,
  options: RenderPhaseOptions
): Promise<RenderPhaseResult> {
  const { llmProvider, theme = "default", onComponents } = options;

  const systemPrompt = buildRenderSystemPrompt(theme);
  const userPrompt = buildSimpleRenderPrompt(synthesis, theme);

  // Generate components using the LLM
  const response = await llmProvider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      maxTokens: 8000,
      temperature: 0.7,
    }
  );

  // Parse the response
  const jsonText = extractJsonArray(response);
  const components = parseComponentArray(jsonText);

  // Notify about new components
  if (onComponents && components.length > 0) {
    await onComponents(components);
  }

  return {
    components,
    theme,
  };
}

/**
 * Build the complete V2 result from synthesis and render phase outputs.
 */
export function buildSynthesisV2Result(
  synthesis: SynthesisResult,
  renderResult: RenderPhaseResult
): SynthesisV2Result {
  return {
    version: 2,
    query: synthesis.query,
    theme: renderResult.theme,
    components: renderResult.components,
    citationIndex: synthesis.citationIndex,
    metadata: {
      bookmarkCount: synthesis.metadata.bookmarkCount,
      componentCount: renderResult.components.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate fallback components when render phase fails.
 * Creates basic InsightCards from notebook blocks.
 */
export function generateFallbackComponents(
  synthesis: SynthesisResult,
  theme: ThemeName
): ComponentSpec[] {
  const components: ComponentSpec[] = [];

  // Add container
  components.push({
    type: "SynthesisContainer",
    id: "container",
    title: synthesis.query,
    subtitle: `Synthesized from ${synthesis.metadata.bookmarkCount} bookmarks`,
    theme,
  });

  // Add section header
  components.push({
    type: "SectionHeader",
    id: "header-insights",
    title: "Key Insights",
    icon: "lightbulb",
  });

  // Convert notebook blocks to InsightCards
  for (const block of synthesis.notebookBlocks) {
    const sources = block.citations.map((c) => ({
      bookmarkId: c.bookmarkId,
      title: c.title,
      url: c.url,
      snippet: c.snippet,
    }));

    components.push({
      type: "InsightCard",
      id: `insight-${block.id}`,
      variant: block.type,
      title: block.title,
      content: block.insight,
      whyItMatters: block.whyItMatters,
      howToApply: block.howToApply,
      sources,
    });
  }

  // Add deep dives section if any
  if (synthesis.deepDives.length > 0) {
    components.push({
      type: "SectionHeader",
      id: "header-deepdives",
      title: "Recommended Reading",
      icon: "book",
    });

    for (const dive of synthesis.deepDives) {
      components.push({
        type: "DeepDiveLink",
        id: `deepdive-${dive.bookmarkId}`,
        bookmarkId: dive.bookmarkId,
        title: dive.title,
        url: dive.url,
        reason: dive.reason,
      });
    }
  }

  // Add sources section
  components.push({
    type: "SectionHeader",
    id: "header-sources",
    title: "Sources",
    icon: "check",
  });

  components.push({
    type: "SourceCluster",
    id: "sources-all",
    label: "All sources",
    sources: synthesis.citationIndex.map((c) => ({
      bookmarkId: c.bookmarkId,
      title: c.title,
      url: c.url,
    })),
  });

  return components;
}
