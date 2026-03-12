import type { SynthesisResult } from "../synthesis/types.js";
import {
  type ExcalidrawElement,
  type SectionType,
  SECTION_COLORS,
  resetSeedCounter,
  createTextElement,
  createRectElement,
  createArrowElement,
  estimateTextWidth,
} from "./templates.js";

export interface ExcalidrawFile {
  type: "excalidraw";
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  appState: { viewBackgroundColor: string; gridSize: null };
}

const CARD_WIDTH = 320;
const COL_SPACING = 360;
const ROW_GAP = 20;
const DEEP_DIVE_X = 780;
const DEEP_DIVE_WIDTH = 260;
const DEEP_DIVE_HEIGHT = 80;
const MAX_CONTENT_CHARS = 150;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

function wrapText(text: string, maxCharsPerLine: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
}

export function generateExcalidrawJson(
  synthesis: SynthesisResult
): ExcalidrawFile {
  resetSeedCounter();

  const elements: ExcalidrawElement[] = [];
  let elementIdx = 0;
  const nextId = () => `el_${elementIdx++}`;

  // Track rect IDs for each section (for arrow connections)
  const sectionRectIds: Array<{
    id: string;
    sourceBookmarkIds: string[];
  }> = [];

  // 1. Title
  const titleText = `Synthesis: ${synthesis.query}`;
  const titleWidth = estimateTextWidth(titleText, 28);
  elements.push(
    createTextElement(nextId(), 400 - titleWidth / 2, 30, titleText, 28, {
      strokeColor: "#1e1e1e",
    })
  );

  // 2. Metadata subtitle
  const metaText = `${synthesis.metadata.bookmarkCount} bookmarks analyzed`;
  const metaWidth = estimateTextWidth(metaText, 14);
  elements.push(
    createTextElement(nextId(), 400 - metaWidth / 2, 70, metaText, 14, {
      strokeColor: "#868e96",
    })
  );

  // 3. Section cards in 2-column grid
  let curY = 120;
  let rowMaxHeight = 0;
  const colXs = [20, 20 + COL_SPACING];

  for (let i = 0; i < synthesis.sections.length; i++) {
    const section = synthesis.sections[i]!;
    const col = i % 2;
    const x = colXs[col]!;

    const colors =
      SECTION_COLORS[section.type as SectionType] ??
      SECTION_COLORS.core_concept;

    // Truncated content, wrapped
    const contentStr = wrapText(
      truncate(section.content, MAX_CONTENT_CHARS),
      45
    );
    const contentLines = contentStr.split("\n").length;
    const cardHeight = 32 + 24 + contentLines * 18 + 24 + 16;
    rowMaxHeight = Math.max(rowMaxHeight, cardHeight);

    // Card rectangle
    const rectId = nextId();
    elements.push(
      createRectElement(rectId, x, curY, CARD_WIDTH, cardHeight, {
        backgroundColor: colors.bg,
        strokeColor: colors.stroke,
        fillStyle: "solid",
      })
    );
    sectionRectIds.push({
      id: rectId,
      sourceBookmarkIds: section.sourceBookmarkIds,
    });

    // Section title
    elements.push(
      createTextElement(nextId(), x + 12, curY + 10, section.title, 16, {
        strokeColor: colors.stroke,
      })
    );

    // Type badge
    const badge = section.type.replace(/_/g, " ");
    elements.push(
      createTextElement(nextId(), x + 12, curY + 32, badge, 11, {
        strokeColor: colors.stroke,
        opacity: 70,
      })
    );

    // Content text
    elements.push(
      createTextElement(nextId(), x + 12, curY + 52, contentStr, 13, {
        strokeColor: "#495057",
      })
    );

    // Advance Y every 2 cards
    if (col === 1 || i === synthesis.sections.length - 1) {
      curY += rowMaxHeight + ROW_GAP;
      rowMaxHeight = 0;
    }
  }

  // 4. Deep Dive cards in a column to the right
  let deepDiveY = 120;
  if (synthesis.deepDives.length > 0) {
    // Deep dive header
    elements.push(
      createTextElement(
        nextId(),
        DEEP_DIVE_X,
        deepDiveY - 30,
        "Deep Dives",
        18,
        {
          strokeColor: "#495057",
        }
      )
    );

    for (const dd of synthesis.deepDives) {
      const ddRectId = nextId();
      elements.push(
        createRectElement(
          ddRectId,
          DEEP_DIVE_X,
          deepDiveY,
          DEEP_DIVE_WIDTH,
          DEEP_DIVE_HEIGHT,
          {
            backgroundColor: "#f8f9fa",
            strokeColor: "#ced4da",
            fillStyle: "solid",
          }
        )
      );

      // Title
      elements.push(
        createTextElement(
          nextId(),
          DEEP_DIVE_X + 10,
          deepDiveY + 8,
          truncate(dd.title, 35),
          13,
          { strokeColor: "#1e1e1e" }
        )
      );

      // Reason
      elements.push(
        createTextElement(
          nextId(),
          DEEP_DIVE_X + 10,
          deepDiveY + 30,
          wrapText(truncate(dd.reason, 80), 35),
          11,
          { strokeColor: "#868e96" }
        )
      );

      deepDiveY += DEEP_DIVE_HEIGHT + 12;
    }
  }

  // 5. Arrows connecting sections that share sourceBookmarkIds
  const arrowPairs = new Set<string>();
  for (let i = 0; i < sectionRectIds.length; i++) {
    for (let j = i + 1; j < sectionRectIds.length; j++) {
      const a = sectionRectIds[i]!;
      const b = sectionRectIds[j]!;
      const shared = a.sourceBookmarkIds.some((id) =>
        b.sourceBookmarkIds.includes(id)
      );
      if (shared) {
        const pairKey = `${a.id}-${b.id}`;
        if (!arrowPairs.has(pairKey)) {
          arrowPairs.add(pairKey);

          // Add boundElements references to the connected rects
          const rectA = elements.find((e) => e.id === a.id);
          const rectB = elements.find((e) => e.id === b.id);
          const arrowId = nextId();
          if (rectA) {
            rectA.boundElements = rectA.boundElements ?? [];
            rectA.boundElements.push({ id: arrowId, type: "arrow" });
          }
          if (rectB) {
            rectB.boundElements = rectB.boundElements ?? [];
            rectB.boundElements.push({ id: arrowId, type: "arrow" });
          }

          elements.push(createArrowElement(arrowId, a.id, b.id, elements));
        }
      }
    }
  }

  return {
    type: "excalidraw",
    version: 2,
    source: "rag-bookmarks",
    elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: null,
    },
  };
}
