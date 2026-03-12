export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: Array<{ id: string; type: string }> | null;
  updated: number;
  link: null;
  locked: boolean;
  // Text-specific fields
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  originalText?: string;
  lineHeight?: number;
  baseline?: number;
  // Arrow-specific fields
  points?: number[][];
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  lastCommittedPoint?: number[] | null;
}

export type SectionType =
  | "core_concept"
  | "consensus"
  | "debate"
  | "practical_pattern"
  | "pitfall"
  | "timeline"
  | "comparison"
  | "mental_model";

export const SECTION_COLORS: Record<
  SectionType,
  { bg: string; stroke: string }
> = {
  core_concept: { bg: "#a5d8ff", stroke: "#1971c2" },
  consensus: { bg: "#b2f2bb", stroke: "#2f9e44" },
  debate: { bg: "#ffc9c9", stroke: "#e03131" },
  practical_pattern: { bg: "#d0bfff", stroke: "#7048e8" },
  pitfall: { bg: "#ffe8cc", stroke: "#e8590c" },
  timeline: { bg: "#c3fae8", stroke: "#099268" },
  comparison: { bg: "#fff3bf", stroke: "#e67700" },
  mental_model: { bg: "#eebefa", stroke: "#ae3ec9" },
};

let seedCounter = 1;
function nextSeed(): number {
  return seedCounter++;
}

export function resetSeedCounter(): void {
  seedCounter = 1;
}

export function createBaseElement(
  id: string,
  type: string,
  x: number,
  y: number,
  overrides: Partial<ExcalidrawElement> = {}
): ExcalidrawElement {
  return {
    id,
    type,
    x,
    y,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...overrides,
  };
}

export function createTextElement(
  id: string,
  x: number,
  y: number,
  text: string,
  fontSize: number,
  overrides: Partial<ExcalidrawElement> = {}
): ExcalidrawElement {
  const lines = text.split("\n");
  const longestLine = lines.reduce(
    (a, b) => (a.length > b.length ? a : b),
    ""
  );
  const width = estimateTextWidth(longestLine, fontSize);
  const lineHeight = 1.25;
  const height = lines.length * fontSize * lineHeight;
  return createBaseElement(id, "text", x, y, {
    width,
    height,
    text,
    fontSize,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: text,
    lineHeight,
    baseline: Math.round(fontSize),
    ...overrides,
  });
}

export function createRectElement(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  overrides: Partial<ExcalidrawElement> = {}
): ExcalidrawElement {
  return createBaseElement(id, "rectangle", x, y, {
    width: w,
    height: h,
    roundness: { type: 3 },
    ...overrides,
  });
}

export function createArrowElement(
  id: string,
  startId: string,
  endId: string,
  allElements: ExcalidrawElement[]
): ExcalidrawElement {
  const startEl = allElements.find((e) => e.id === startId);
  const endEl = allElements.find((e) => e.id === endId);

  if (!startEl || !endEl) {
    // Fallback: create a zero-length arrow
    return createBaseElement(id, "arrow", 0, 0, {
      width: 0,
      height: 0,
      points: [[0, 0]],
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: "arrow",
      lastCommittedPoint: null,
      strokeStyle: "dashed",
    });
  }

  const startCenterX = startEl.x + startEl.width / 2;
  const startCenterY = startEl.y + startEl.height / 2;
  const endCenterX = endEl.x + endEl.width / 2;
  const endCenterY = endEl.y + endEl.height / 2;

  const startEdge = computeEdgePoint(startEl, endCenterX, endCenterY);
  const endEdge = computeEdgePoint(endEl, startCenterX, startCenterY);

  const dx = endEdge.x - startEdge.x;
  const dy = endEdge.y - startEdge.y;

  return createBaseElement(id, "arrow", startEdge.x, startEdge.y, {
    width: Math.abs(dx),
    height: Math.abs(dy),
    points: [
      [0, 0],
      [dx, dy],
    ],
    startBinding: { elementId: startId, focus: 0, gap: 4 },
    endBinding: { elementId: endId, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: "arrow",
    lastCommittedPoint: null,
    strokeStyle: "dashed",
    strokeWidth: 1,
    opacity: 60,
  });
}

export function computeEdgePoint(
  element: ExcalidrawElement,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const hw = element.width / 2;
  const hh = element.height / 2;

  const dx = targetX - cx;
  const dy = targetY - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  const angle = Math.atan2(dy, dx);
  const absTan = Math.abs(Math.tan(angle));

  let edgeX: number;
  let edgeY: number;

  if (absTan <= hh / hw) {
    // Intersects left or right edge
    edgeX = dx > 0 ? cx + hw : cx - hw;
    edgeY = cy + hw * absTan * Math.sign(dy);
  } else {
    // Intersects top or bottom edge
    edgeY = dy > 0 ? cy + hh : cy - hh;
    edgeX = cx + (hh / absTan) * Math.sign(dx);
  }

  return { x: edgeX, y: edgeY };
}

export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}
