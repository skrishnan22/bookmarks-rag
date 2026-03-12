import { describe, expect, it, vi } from "vitest";
import type { LLMProvider } from "../../providers/types.js";
import type { BatchExtractionResult } from "./types.js";
import { synthesizeFromExtractions } from "./reducer.js";

function createMockLlmProvider(response: Record<string, unknown>): LLMProvider {
  return {
    complete: vi.fn(async () => ""),
    chat: vi.fn(async () => ""),
    generateObject: vi.fn(async () => response),
  };
}

function buildBaseExtractions(): BatchExtractionResult[] {
  return [
    {
      bookmarkIds: ["bookmark-1"],
      extractedThemes: [],
      conflicts: [],
      patterns: [],
    },
  ];
}

describe("synthesizeFromExtractions", () => {
  it("attaches chunk-level citations to notebook blocks", async () => {
    const provider = createMockLlmProvider({
      narrativeMarkdown: "- Useful claim [1]",
      sections: [
        {
          id: "core-idea",
          type: "core_concept",
          title: "Core idea",
          content: "A grounded summary [1]",
          sourceBookmarkIndices: [1],
        },
      ],
      deepDives: [{ bookmarkIndex: 1, reason: "Most actionable source" }],
      notebookBlocks: [
        {
          id: "claim-1",
          type: "key_insight",
          title: "Strong claim",
          insight: "The system is robust.",
          whyItMatters: "Reliability reduces operational incidents.",
          howToApply: "Adopt retries, timeouts, and circuit breakers.",
          sourceBookmarkIndices: [1],
        },
      ],
    });

    const result = await synthesizeFromExtractions(
      buildBaseExtractions(),
      "robust systems",
      new Map([
        [
          "bookmark-1",
          {
            title: "Designing robust systems",
            url: "https://example.com/robust",
          },
        ],
      ]),
      new Map([
        [
          "bookmark-1",
          [
            {
              chunkId: "chunk-1",
              snippet: "Circuit breakers and retries improve resilience.",
            },
            {
              chunkId: "chunk-2",
              snippet: "Timeouts should be explicit and observable.",
            },
          ],
        ],
      ]),
      provider
    );

    expect(result.notebookBlocks).toHaveLength(1);
    expect(result.citationIndex).toEqual([
      {
        index: 1,
        bookmarkId: "bookmark-1",
        title: "Designing robust systems",
        url: "https://example.com/robust",
      },
    ]);
    expect(result.notebookBlocks[0]?.citations).toEqual([
      {
        bookmarkId: "bookmark-1",
        chunkId: "chunk-1",
        title: "Designing robust systems",
        url: "https://example.com/robust",
        snippet: "Circuit breakers and retries improve resilience.",
      },
    ]);
    expect(result.trust.totalCitations).toBe(1);
    expect(result.trust.sourceDiversity).toBe(1);
  });

  it("drops citation-required blocks without valid chunk citations", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const provider = createMockLlmProvider({
      narrativeMarkdown: "- Notes",
      sections: [
        {
          id: "core-idea",
          type: "core_concept",
          title: "Core idea",
          content: "A grounded summary [1]",
          sourceBookmarkIndices: [1],
        },
      ],
      deepDives: [{ bookmarkIndex: 1, reason: "Most actionable source" }],
      notebookBlocks: [
        {
          id: "evidence-dedup",
          type: "tradeoff",
          title: "Duplicate sources",
          insight: "Repeated source references",
          whyItMatters: "Single-source views can hide disagreement.",
          howToApply: "Cross-check with at least one additional source.",
          sourceBookmarkIndices: [1, 1],
        },
        {
          id: "invalid-claim",
          type: "key_insight",
          title: "Invalid",
          insight: "No valid refs",
          whyItMatters: "Ungrounded claims reduce trust.",
          howToApply: "Attach at least one valid citation.",
          sourceBookmarkIndices: [99],
        },
      ],
    });

    const result = await synthesizeFromExtractions(
      buildBaseExtractions(),
      "robust systems",
      new Map([
        [
          "bookmark-1",
          {
            title: "Designing robust systems",
            url: "https://example.com/robust",
          },
        ],
      ]),
      new Map([
        [
          "bookmark-1",
          [
            {
              chunkId: "chunk-1",
              snippet: "Circuit breakers and retries improve resilience.",
            },
          ],
        ],
      ]),
      provider
    );

    expect(result.notebookBlocks).toHaveLength(1);
    expect(result.notebookBlocks[0]?.id).toBe("evidence-dedup");
    expect(result.notebookBlocks[0]?.citations).toHaveLength(1);
    expect(result.notebookBlocks[0]?.citations[0]?.chunkId).toBe("chunk-1");

    warnSpy.mockRestore();
  });
});
