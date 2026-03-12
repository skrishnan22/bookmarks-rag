import { ComponentSpecSchema, type ComponentSpec } from "./component-schemas.js";

/**
 * Incrementally parses streaming JSON array of components.
 * Emits valid components as they are completed.
 */
export class StreamingComponentParser {
  private buffer = "";
  private components: ComponentSpec[] = [];
  private depth = 0;
  private inString = false;
  private escapeNext = false;
  private objectStart = -1;
  private bracketStack: string[] = [];

  /**
   * Feed new text chunk to the parser.
   * Returns newly parsed valid components.
   */
  feed(chunk: string): ComponentSpec[] {
    const newComponents: ComponentSpec[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];
      this.buffer += char;

      // Handle escape sequences in strings
      if (this.escapeNext) {
        this.escapeNext = false;
        continue;
      }

      if (char === "\\" && this.inString) {
        this.escapeNext = true;
        continue;
      }

      // Handle string boundaries
      if (char === '"' && !this.escapeNext) {
        this.inString = !this.inString;
        continue;
      }

      // Skip if inside a string
      if (this.inString) {
        continue;
      }

      // Track array/object depth
      if (char === "[") {
        this.bracketStack.push("[");
        // Skip the top-level array opening
        if (this.bracketStack.length === 1) {
          this.buffer = "";
        }
      } else if (char === "{") {
        this.bracketStack.push("{");
        if (this.objectStart === -1 && this.isAtObjectLevel()) {
          this.objectStart = this.buffer.length - 1;
        }
      } else if (char === "]") {
        this.bracketStack.pop();
      } else if (char === "}") {
        this.bracketStack.pop();

        // Check if we completed a top-level object
        if (this.isAtArrayLevel()) {
          const objectStr = this.buffer.slice(this.objectStart);
          const parsed = this.tryParseComponent(objectStr);
          if (parsed) {
            newComponents.push(parsed);
            this.components.push(parsed);
          }
          this.buffer = "";
          this.objectStart = -1;
        }
      }
    }

    return newComponents;
  }

  /**
   * Check if we're at the level where objects are direct children of the array.
   */
  private isAtObjectLevel(): boolean {
    // We want to be inside the array (1 deep) and about to start an object
    return this.bracketStack.length === 1 && this.bracketStack[0] === "[";
  }

  /**
   * Check if we just closed an object at the array level.
   */
  private isAtArrayLevel(): boolean {
    return this.bracketStack.length === 1 && this.bracketStack[0] === "[";
  }

  /**
   * Try to parse a string as a component.
   */
  private tryParseComponent(str: string): ComponentSpec | null {
    // Clean up the string - remove leading/trailing whitespace and commas
    let cleaned = str.trim();
    if (cleaned.startsWith(",")) {
      cleaned = cleaned.slice(1).trim();
    }
    if (cleaned.endsWith(",")) {
      cleaned = cleaned.slice(0, -1).trim();
    }

    try {
      const obj = JSON.parse(cleaned);
      const result = ComponentSpecSchema.safeParse(obj);
      if (result.success) {
        return result.data;
      }
      console.warn("Component validation failed:", result.error.message);
      return null;
    } catch {
      // Not valid JSON yet
      return null;
    }
  }

  /**
   * Get all successfully parsed components.
   */
  getComponents(): ComponentSpec[] {
    return [...this.components];
  }

  /**
   * Get number of parsed components.
   */
  getCount(): number {
    return this.components.length;
  }

  /**
   * Attempt to parse any remaining buffer content.
   * Call this when the stream ends.
   */
  flush(): ComponentSpec[] {
    const newComponents: ComponentSpec[] = [];

    if (this.objectStart !== -1) {
      // Try to parse the remaining buffer as a component
      let remaining = this.buffer.slice(this.objectStart).trim();

      // Handle case where array ends
      if (remaining.endsWith("]")) {
        remaining = remaining.slice(0, -1).trim();
      }
      if (remaining.endsWith(",")) {
        remaining = remaining.slice(0, -1).trim();
      }

      const parsed = this.tryParseComponent(remaining);
      if (parsed) {
        newComponents.push(parsed);
        this.components.push(parsed);
      }
    }

    return newComponents;
  }

  /**
   * Reset the parser state.
   */
  reset(): void {
    this.buffer = "";
    this.components = [];
    this.depth = 0;
    this.inString = false;
    this.escapeNext = false;
    this.objectStart = -1;
    this.bracketStack = [];
  }
}

/**
 * Simple non-streaming parser for complete JSON array.
 */
export function parseComponentArray(json: string): ComponentSpec[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) {
      throw new Error("Expected JSON array");
    }

    const components: ComponentSpec[] = [];
    for (const item of arr) {
      const result = ComponentSpecSchema.safeParse(item);
      if (result.success) {
        components.push(result.data);
      } else {
        console.warn("Skipping invalid component:", result.error.message);
      }
    }

    return components;
  } catch (error) {
    console.error("Failed to parse component array:", error);
    return [];
  }
}

/**
 * Extract JSON array from LLM response that might have markdown code blocks.
 */
export function extractJsonArray(text: string): string {
  // Try to find JSON in code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try to find array directly
  const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch && arrayMatch[0]) {
    return arrayMatch[0];
  }

  // Return as-is and hope for the best
  return text.trim();
}
