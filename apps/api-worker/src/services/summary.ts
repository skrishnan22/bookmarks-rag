import type { LLMProvider } from "../providers/types.js";

const MAX_INPUT_CHARS = 16000;

const SYSTEM_PROMPT = `You are a helpful assistant that summarizes web pages. Write clear, informative summaries that capture the key points.`;

function buildUserPrompt(title: string, markdown: string): string {
  const truncatedMarkdown =
    markdown.length > MAX_INPUT_CHARS
      ? markdown.slice(0, MAX_INPUT_CHARS) + "\n\n[Content truncated...]"
      : markdown;

  return `Summarize this webpage in 3-5 sentences. Focus on:
1. What the page is about
2. Key information or takeaways

Title: ${title}

Content:
${truncatedMarkdown}

Write only the summary, nothing else.`;
}

export async function generateSummary(
  markdown: string,
  title: string,
  llmProvider: LLMProvider
): Promise<string> {
  const summary = await llmProvider.chat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(title, markdown) },
    ],
    {
      maxTokens: 300,
      temperature: 0.3,
    }
  );

  return summary.trim();
}
