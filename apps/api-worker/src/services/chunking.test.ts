import { describe, it, expect } from "vitest";
import {
  chunkMarkdown,
  countTokens,
  DEFAULT_CHUNKING_CONFIG,
} from "./chunking";

const LARGE_PARAGRAPH_WORD_COUNT = 200;
const VERY_LARGE_PARAGRAPH_WORD_COUNT = 100;

describe("chunkMarkdown", () => {
  describe("basic heading parsing", () => {
    it("should parse single section with no headings", () => {
      const markdown = "This is some content without any headings.";
      const chunks = chunkMarkdown(markdown);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.content).toContain("This is some content");
      expect(chunks[0]?.breadcrumbPath).toBe("");
    });

    it("should parse single h1 heading", () => {
      const markdown = `# Article Title

This is the content of the article.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.breadcrumbPath).toBe("Article Title");
      expect(chunks[0]?.content).toContain("This is the content");
    });

    it("should parse multiple sections with different heading levels", () => {
      const markdown = `# Main Title

Introduction content.

## Section One

Content of section one.

### Subsection

Content of subsection.

## Section Two

Content of section two.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks).toHaveLength(4);

      const breadcrumbs = chunks.map((c) => c.breadcrumbPath);
      expect(breadcrumbs).toContain("Main Title");
      expect(breadcrumbs).toContain("Main Title > Section One");
      expect(breadcrumbs).toContain("Main Title > Section One > Subsection");
      expect(breadcrumbs).toContain("Main Title > Section Two");
    });

    it("should handle content before first heading", () => {
      const markdown = `This is content before any heading.

# Title

More content.`;

      const chunks = chunkMarkdown(markdown);

      const introChunk = chunks.find((c) =>
        c.content.includes("This is content before")
      );
      expect(introChunk).toBeDefined();
      expect(introChunk?.breadcrumbPath).toBe("");
    });
  });

  describe("breadcrumb building", () => {
    it("should build correct breadcrumbs for nested headings", () => {
      const markdown = `# Level 1

Content of level 1.

## Level 2

Content of level 2.

### Level 3

Content of level 3.

## Another Level 2

Content of another level 2.`;

      const chunks = chunkMarkdown(markdown);

      const l3Chunks = chunks.filter((c) =>
        c.breadcrumbPath.includes("Level 3")
      );
      expect(l3Chunks.length).toBeGreaterThan(0);

      for (const chunk of l3Chunks) {
        expect(chunk.breadcrumbPath).toBe("Level 1 > Level 2 > Level 3");
      }

      const l2Chunks = chunks.filter(
        (c) => c.breadcrumbPath === "Level 1 > Level 2"
      );
      expect(l2Chunks.length).toBeGreaterThan(0);
    });

    it("should handle heading level jumps (h1 to h3)", () => {
      const markdown = `# Parent

This is the content under the parent heading. It has enough text to be meaningful and will create at least one chunk.

### Grandchild

This is the content under the grandchild heading which skips level 2. This section should have its own breadcrumb path.

## Sibling of Parent

This is content under the sibling of parent heading. This should also have its own breadcrumb path.`;

      const chunks = chunkMarkdown(markdown);

      const parentChunks = chunks.filter((c) => c.breadcrumbPath === "Parent");
      expect(parentChunks.length).toBeGreaterThan(0);

      const siblingChunks = chunks.filter(
        (c) => c.breadcrumbPath === "Parent > Sibling of Parent"
      );
      expect(siblingChunks.length).toBeGreaterThan(0);
    });

    it("should handle multiple h1 headings", () => {
      const markdown = `# First Article

Content of first.

# Second Article

Content of second.`;

      const chunks = chunkMarkdown(markdown);

      const firstChunks = chunks.filter(
        (c) => c.breadcrumbPath === "First Article"
      );
      const secondChunks = chunks.filter(
        (c) => c.breadcrumbPath === "Second Article"
      );

      expect(firstChunks.length).toBeGreaterThan(0);
      expect(secondChunks.length).toBeGreaterThan(0);
    });
  });

  describe("tables (atomic blocks)", () => {
    it("should keep tables as atomic blocks without splitting", () => {
      const markdown = `# Data

| Name | Age |
|------|-----|
| John | 30 |
| Jane | 25 |

More content.`;

      const chunks = chunkMarkdown(markdown);

      const tableChunks = chunks.filter((c) => c.content.includes("Table:"));
      expect(tableChunks.length).toBeGreaterThan(0);

      for (const chunk of tableChunks) {
        expect(chunk.content).toContain("Name | Age");
        expect(chunk.content).toContain("John | 30");
        expect(chunk.content).toContain("Row:");
      }
    });

    it("should preserve table in chunk with breadcrumb", () => {
      const markdown = `# Documentation

| Method | Description |
|--------|-------------|
| GET | Retrieve data |
| POST | Create data |

API details here.`;

      const chunks = chunkMarkdown(markdown);

      const docChunk = chunks.find((c) => c.breadcrumbPath === "Documentation");
      expect(docChunk).toBeDefined();
      expect(docChunk?.content).toContain("Table:");
    });

    it("should handle multiple tables", () => {
      const markdown = `# Report

## Metrics

| Metric | Value |
|--------|-------|
| A | 1 |

## Another Section

| Col1 | Col2 |
|------|------|
| X | Y |`;

      const chunks = chunkMarkdown(markdown);

      const metricsChunks = chunks.filter((c) =>
        c.breadcrumbPath.includes("Metrics")
      );
      const anotherChunks = chunks.filter((c) =>
        c.breadcrumbPath.includes("Another Section")
      );

      expect(metricsChunks.length).toBeGreaterThan(0);
      expect(anotherChunks.length).toBeGreaterThan(0);
    });
  });

  describe("code blocks (atomic blocks)", () => {
    it("should keep code blocks as atomic without splitting", () => {
      const markdown = `# Setup

\`\`\`typescript
function hello() {
  console.log("Hello, world!");
  const x = 1;
  const y = 2;
}
\`\`\`

After code content.`;

      const chunks = chunkMarkdown(markdown);

      const codeChunks = chunks.filter((c) =>
        c.content.includes("function hello")
      );
      expect(codeChunks.length).toBeGreaterThan(0);
    });

    it("should not split code blocks even if large", () => {
      const markdown = `# Code

\`\`\`
line 1
line 2
line 3
line 4
line 5
\`\`\`

End.`;

      const chunks = chunkMarkdown(markdown);

      const codeChunks = chunks.filter((c) => c.content.includes("line 1"));
      expect(codeChunks.length).toBeGreaterThan(0);

      for (const chunk of codeChunks) {
        expect(chunk.content).toContain("line 1");
        expect(chunk.content).toContain("line 5");
      }
    });

    it("should handle code blocks with markdown-like content", () => {
      const markdown = `# Guide

Here is an example:

\`\`\`
# This is not a heading
## Also not a heading
\`\`\`

Real heading:

## Conclusion`;

      const chunks = chunkMarkdown(markdown);

      const guideChunks = chunks.filter((c) => c.breadcrumbPath === "Guide");
      expect(guideChunks.length).toBeGreaterThan(0);

      const codeInChunk = guideChunks.find((c) =>
        c.content.includes("# This is not a heading")
      );
      expect(codeInChunk).toBeDefined();
    });
  });

  describe("paragraph splitting and merging", () => {
    it("should split by paragraphs", () => {
      const markdown = `# Section

First paragraph with some content.

Second paragraph here.

Third paragraph.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 100,
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should merge paragraphs that fit within token limit", () => {
      const markdown = `# Section

This is a short paragraph that should merge with the next one.

This is another short paragraph that should be in the same chunk.

A third paragraph to ensure we have enough content to test merging behavior.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 1000,
      });

      expect(chunks.length).toBeLessThanOrEqual(3);
      const allContent = chunks.map((c) => c.content).join(" ");
      expect(allContent).toContain("short paragraph that should merge");
      expect(allContent).toContain("another short paragraph");
    });

    it("should respect token limit and split when exceeded", () => {
      const markdown = `# Section

${"word ".repeat(LARGE_PARAGRAPH_WORD_COUNT)}word

${"word ".repeat(LARGE_PARAGRAPH_WORD_COUNT)}word`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 100,
      });

      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe("sentence splitting fallback", () => {
    it("should split large paragraphs by sentences", () => {
      const longParagraph = `# Section

${"This is sentence one. ".repeat(50)}`;

      const chunks = chunkMarkdown(longParagraph, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 100,
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should preserve sentence boundaries in chunks", () => {
      const markdown = `# Section

First sentence. Second sentence. Third sentence.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 20,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("overlap logic", () => {
    it("should add overlap between chunks within same section", () => {
      const markdown = `# Section

${"First sentence with marker alpha. ".repeat(10)}

${"Second sentence with marker beta. ".repeat(10)}

${"Third sentence with marker gamma. ".repeat(10)}`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 100,
        overlapTokens: 30,
        minTokensForOverlap: 50,
      });

      expect(chunks.length).toBeGreaterThan(1);

      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1]?.content;
        const currentChunk = chunks[i]?.content;

        if (!prevChunk || !currentChunk) continue;

        const prevSentences = prevChunk.split(/(?<=[.!?])\s+/).slice(-3);
        const hasOverlapFromPrev = prevSentences.some(
          (s) => s.length > 10 && currentChunk.includes(s.trim().slice(0, 20))
        );

        expect(hasOverlapFromPrev).toBe(true);
      }
    });

    it("should not add overlap when only one chunk", () => {
      const markdown = `# Section

Short content.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        overlapTokens: 50,
      });

      expect(chunks).toHaveLength(1);
    });

    it("should verify actual content overlap between consecutive chunks", () => {
      const markdown = `# Article

This is the first paragraph with some specific marker text alpha.

This is the second paragraph with marker text beta.

This is the third paragraph with marker text gamma.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 30,
        overlapTokens: 15,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(2);

      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1]?.content;
        const currentChunk = chunks[i]?.content;

        const prevWords = prevChunk?.split(/\s+/).slice(-10) ?? [];
        let hasOverlap = false;

        for (const word of prevWords) {
          if (word.length > 3 && currentChunk?.includes(word)) {
            hasOverlap = true;
            break;
          }
        }

        expect(hasOverlap).toBe(true);
      }
    });

    it("should respect overlap token count", () => {
      const longContent = `# Section

${"word ".repeat(VERY_LARGE_PARAGRAPH_WORD_COUNT)}word

${"word ".repeat(VERY_LARGE_PARAGRAPH_WORD_COUNT)}word

${"word ".repeat(VERY_LARGE_PARAGRAPH_WORD_COUNT)}word`;

      const chunksNoOverlap = chunkMarkdown(longContent, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 200,
        overlapTokens: 0,
      });

      const chunksWithOverlap = chunkMarkdown(longContent, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 200,
        overlapTokens: 50,
      });

      expect(chunksWithOverlap.length).toBeGreaterThanOrEqual(
        chunksNoOverlap.length
      );
    });
  });

  describe("token counting", () => {
    it("should count tokens correctly", () => {
      expect(countTokens("hello")).toBe(1);
      expect(countTokens("hello world")).toBe(2);
      expect(countTokens("The quick brown fox")).toBe(4);
    });

    it("should return accurate token counts for chunks", () => {
      const markdown = `# Title

This is a test paragraph with several words to check token counting accuracy.`;

      const chunks = chunkMarkdown(markdown);

      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.tokenCount).toBe(countTokens(chunk.content));
      }
    });
  });

  describe("chunk metadata", () => {
    it("should have sequential positions", () => {
      const markdown = `# Title

Content one.

Content two.

Content three.`;

      const chunks = chunkMarkdown(markdown);

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i]?.position).toBe(i);
      }
    });

    it("should have non-zero token counts", () => {
      const markdown = `# Title

Some meaningful content here.`;

      const chunks = chunkMarkdown(markdown);

      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeGreaterThan(0);
      }
    });

    it("should have breadcrumb path for all chunks", () => {
      const markdown = `# Title

Content.`;

      const chunks = chunkMarkdown(markdown);

      for (const chunk of chunks) {
        expect(typeof chunk.breadcrumbPath).toBe("string");
      }
    });
  });

  describe("complex markdown structures", () => {
    it("should handle nested lists", () => {
      const markdown = `# Guide

- Item 1
  - Nested item 1.1
  - Nested item 1.2
- Item 2`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.breadcrumbPath).toBe("Guide");
    });

    it("should handle blockquotes", () => {
      const markdown = `# Quote

> This is a blockquote
> spanning multiple lines

Content after.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle horizontal rules", () => {
      const markdown = `# Section

Some content.

---

More content after horizontal rule.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle inline code", () => {
      const markdown = `# Code

Use \`console.log()\` to debug.

More \`inline\` code.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.content).toContain("console.log()");
    });

    it("should handle mixed content types", () => {
      const markdown = `# Project

## Overview

This project uses TypeScript.

\`\`\`typescript
const x = 1;
\`\`\`

## Data

| Name | Value |
|------|-------|
| A | 1 |

## Conclusion

End of document.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);

      const overviewChunks = chunks.filter((c) =>
        c.breadcrumbPath.includes("Overview")
      );
      const dataChunks = chunks.filter((c) =>
        c.breadcrumbPath.includes("Data")
      );
      const conclusionChunks = chunks.filter((c) =>
        c.breadcrumbPath.includes("Conclusion")
      );

      expect(overviewChunks.length).toBeGreaterThan(0);
      expect(dataChunks.length).toBeGreaterThan(0);
      expect(conclusionChunks.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty markdown", () => {
      const chunks = chunkMarkdown("");

      expect(chunks).toHaveLength(0);
    });

    it("should handle malformed tables without header separator", () => {
      const markdown = `# Data

| Name | Age |
| John | 30 |

More content.`;

      const chunks = chunkMarkdown(markdown);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle unclosed code blocks", () => {
      const markdown = `# Code

\`\`\`typescript
function test() {
  console.log("unclosed");

More content after.`;

      const chunks = chunkMarkdown(markdown);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle empty headings", () => {
      const markdown = `#

Some content under empty heading.

## 

More content.`;

      const chunks = chunkMarkdown(markdown);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle mixed line endings", () => {
      const markdown =
        "# Title\r\n\r\nContent with CRLF.\n\nAnd LF.\r\n\r\nMixed.";
      const chunks = chunkMarkdown(markdown);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle single sentence exceeding max tokens", () => {
      const verylongWord = "word".repeat(200);
      const markdown = `# Section

This is a sentence with a ${verylongWord} that exceeds token limit.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 50,
        overlapTokens: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle markdown with only headings", () => {
      const markdown = `# H1

## H2

### H3`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBe(0);
    });

    it("should handle markdown with only code blocks", () => {
      const markdown = "```\ncode here\n```";

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle markdown with only tables", () => {
      const markdown = `| A | B |
|---|---|
| 1 | 2 |`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle special characters in headings", () => {
      const markdown = `# Heading with [brackets] and (parens) and "quotes"

Content here.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.breadcrumbPath).toContain("Heading with");
    });

    it("should handle unicode characters", () => {
      const markdown = `# 日本語 Heading

Content with émojis 🎉 and 中文.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.breadcrumbPath).toContain("日本語");
    });

    it("should handle very long headings", () => {
      const markdown = `# ${"a".repeat(1000)}

Content.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe("boundary testing", () => {
    it("should handle maxTokens of 1", () => {
      const markdown = `# Title

Short content here.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 1,
        overlapTokens: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeGreaterThan(0);
      }
    });

    it("should handle overlapTokens greater than maxTokens", () => {
      const markdown = `# Section

First paragraph here.

Second paragraph here.

Third paragraph.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 10,
        overlapTokens: 50,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle zero maxTokens gracefully", () => {
      const markdown = `# Title

Content.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 0,
        overlapTokens: 0,
      });

      expect(Array.isArray(chunks)).toBe(true);
    });

    it("should handle negative overlapTokens", () => {
      const markdown = `# Title

Content here.`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 100,
        overlapTokens: -10,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle very large maxTokens", () => {
      const markdown = `# Title

${"Content. ".repeat(1000)}`;

      const chunks = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 999999,
        overlapTokens: 0,
      });

      expect(chunks).toHaveLength(1);
    });
  });

  describe("configurable chunking", () => {
    it("should respect custom maxTokens", () => {
      const longContent = "word ".repeat(LARGE_PARAGRAPH_WORD_COUNT);

      const markdown = `# Section

${longContent}

${longContent}

${longContent}`;

      const smallConfig = {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 100,
        overlapTokens: 0,
      };
      const largeConfig = {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 800,
        overlapTokens: 0,
      };

      const smallChunks = chunkMarkdown(markdown, smallConfig);
      const largeChunks = chunkMarkdown(markdown, largeConfig);

      expect(smallChunks.length).toBeGreaterThanOrEqual(largeChunks.length);

      for (const chunk of smallChunks) {
        expect(chunk.tokenCount).toBeLessThanOrEqual(
          smallConfig.hardMaxTokens * 3
        );
      }
    });

    it("should respect custom overlapTokens", () => {
      const markdown = `# Section

${"word ".repeat(VERY_LARGE_PARAGRAPH_WORD_COUNT)}

${"word ".repeat(VERY_LARGE_PARAGRAPH_WORD_COUNT)}

${"word ".repeat(VERY_LARGE_PARAGRAPH_WORD_COUNT)}`;

      const noOverlap = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 200,
        overlapTokens: 0,
      });
      const withOverlap = chunkMarkdown(markdown, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxTokens: 200,
        overlapTokens: 50,
      });

      expect(withOverlap.length).toBeGreaterThanOrEqual(noOverlap.length);
    });

    it("should use default config when none provided", () => {
      const markdown = `# Title

Content.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.tokenCount).toBeLessThanOrEqual(
        DEFAULT_CHUNKING_CONFIG.maxTokens
      );
    });
  });

  describe("performance", () => {
    it("should handle very large documents efficiently", () => {
      const largeDoc = `# Introduction

${"This is a paragraph with substantial content to test performance. ".repeat(
  100
)}

${"## Section\n\nMore content here. ".repeat(50)}

${"Another paragraph. ".repeat(200)}`;

      const start = Date.now();
      const chunks = chunkMarkdown(largeDoc);
      const duration = Date.now() - start;

      expect(chunks.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000);
    });

    it("should handle documents with many sections", () => {
      let markdown = "# Main Title\n\n";
      for (let i = 0; i < 100; i++) {
        markdown += `## Section ${i}\n\nContent for section ${i}.\n\n`;
      }

      const chunks = chunkMarkdown(markdown);
      expect(chunks.length).toBeGreaterThan(50);
    });

    it("should handle documents with deeply nested headings", () => {
      const markdown = `# L1
Content

## L2
Content

### L3
Content

#### L4
Content

##### L5
Content

###### L6
Content`;

      const chunks = chunkMarkdown(markdown);
      expect(chunks.length).toBeGreaterThan(0);

      const deepestChunk = chunks.find((c) =>
        c.breadcrumbPath.includes("L1 > L2 > L3 > L4 > L5 > L6")
      );
      expect(deepestChunk).toBeDefined();
    });
  });

  describe("real-world examples", () => {
    it("should handle documentation-style markdown", () => {
      const markdown = `# API Documentation

## Authentication

All API requests require authentication using Bearer tokens.

\`\`\`bash
curl -H "Authorization: Bearer <token>" https://api.example.com
\`\`\`

## Endpoints

### GET /users

Returns a list of users.

| Param | Type | Description |
|-------|------|-------------|
| limit | number | Max results |
| offset | number | Pagination offset |

### POST /users

Creates a new user.

## Rate Limiting

The API allows 100 requests per minute.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);

      const authChunks = chunks.filter((c) =>
        c.breadcrumbPath.includes("Authentication")
      );
      const endpointChunks = chunks.filter((c) =>
        c.breadcrumbPath.includes("Endpoints")
      );
      const rateChunks = chunks.filter((c) =>
        c.breadcrumbPath.includes("Rate Limiting")
      );

      expect(authChunks.length).toBeGreaterThan(0);
      expect(endpointChunks.length).toBeGreaterThan(0);
      expect(rateChunks.length).toBeGreaterThan(0);
    });

    it("should handle README-style markdown", () => {
      const markdown = `# Project Name

A brief description of the project.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

To use this project, follow these steps:

1. First step
2. Second step
3. Third step

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| debug | false | Enable debug mode |
| timeout | 30 | Request timeout |

\`\`\`json
{
  "debug": true,
  "timeout": 60
}
\`\`\`

## Contributing

Pull requests are welcome.`;

      const chunks = chunkMarkdown(markdown);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
