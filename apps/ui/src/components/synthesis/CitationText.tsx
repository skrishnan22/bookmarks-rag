import type { ReactNode } from "react";
import type { SynthesisCitationReference } from "~/lib/api";

interface CitationTextProps {
  text: string;
  citationsByIndex: Map<number, SynthesisCitationReference>;
  className?: string;
}

const CITATION_PATTERN = /\[(\d+)\]/g;

export function CitationText({
  text,
  citationsByIndex,
  className,
}: CitationTextProps) {
  return (
    <span className={className}>{renderCitations(text, citationsByIndex)}</span>
  );
}

function renderCitations(
  text: string,
  citationsByIndex: Map<number, SynthesisCitationReference>
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  CITATION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = CITATION_PATTERN.exec(text);

  while (match !== null) {
    const fullMatch = match[0];
    const matchStart = match.index;
    const matchEnd = matchStart + fullMatch.length;
    const index = Number(match[1]);

    if (matchStart > cursor) {
      nodes.push(text.slice(cursor, matchStart));
    }

    const citation = citationsByIndex.get(index);
    if (citation) {
      nodes.push(
        <a
          key={`citation-${index}-${matchStart}`}
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          title={citation.title}
          className="font-semibold text-amber-700 hover:text-amber-800 hover:underline"
        >
          {fullMatch}
        </a>
      );
    } else {
      nodes.push(fullMatch);
    }

    cursor = matchEnd;
    match = CITATION_PATTERN.exec(text);
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}
