import { motion } from "framer-motion";
import type {
  SynthesisSection,
  SectionType,
  SynthesisCitationReference,
} from "~/lib/api";
import { CitationText } from "~/components/synthesis/CitationText";

const SECTION_COLORS: Record<SectionType, { bg: string; text: string }> = {
  core_concept: { bg: "bg-blue-100", text: "text-blue-700" },
  consensus: { bg: "bg-green-100", text: "text-green-700" },
  debate: { bg: "bg-red-100", text: "text-red-700" },
  practical_pattern: { bg: "bg-purple-100", text: "text-purple-700" },
  pitfall: { bg: "bg-orange-100", text: "text-orange-700" },
  timeline: { bg: "bg-teal-100", text: "text-teal-700" },
  comparison: { bg: "bg-yellow-100", text: "text-yellow-700" },
  mental_model: { bg: "bg-pink-100", text: "text-pink-700" },
};

const TYPE_LABELS: Record<SectionType, string> = {
  core_concept: "Core Concept",
  consensus: "Consensus",
  debate: "Debate",
  practical_pattern: "Practical Pattern",
  pitfall: "Pitfall",
  timeline: "Timeline",
  comparison: "Comparison",
  mental_model: "Mental Model",
};

interface SynthesisSectionCardProps {
  section: SynthesisSection;
  index: number;
  citationIndex: SynthesisCitationReference[];
}

export function SynthesisSectionCard({
  section,
  index,
  citationIndex,
}: SynthesisSectionCardProps) {
  const colors = SECTION_COLORS[section.type] ?? {
    bg: "bg-zinc-100",
    text: "text-zinc-700",
  };
  const label = TYPE_LABELS[section.type] ?? section.type;
  const citationsByIndex = new Map(
    citationIndex.map((entry) => [entry.index, entry])
  );
  const citationsByBookmarkId = new Map(
    citationIndex.map((entry) => [entry.bookmarkId, entry])
  );
  const paragraphs = section.content
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0);
  const sourceLinks = section.sourceBookmarkIds
    .map((bookmarkId) => citationsByBookmarkId.get(bookmarkId))
    .filter(
      (citation): citation is SynthesisCitationReference =>
        citation !== undefined
    )
    .slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="rounded-xl border border-zinc-200 bg-white p-5"
    >
      <div className="flex items-start gap-3 mb-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}
        >
          {label}
        </span>
      </div>
      <h3 className="text-base font-bold text-zinc-900 mb-2">
        {section.title}
      </h3>
      <div className="space-y-2">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-zinc-600 leading-relaxed">
            <CitationText text={p.trim()} citationsByIndex={citationsByIndex} />
          </p>
        ))}
      </div>
      {sourceLinks.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {sourceLinks.map((source) => (
            <a
              key={`${section.id}-${source.bookmarkId}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:border-zinc-300 hover:bg-white"
            >
              [{source.index}] {source.title}
            </a>
          ))}
        </div>
      )}
    </motion.div>
  );
}
