import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import {
  createSynthesisRun,
  getSynthesisRun,
  type SynthesisRunPhase,
  type SynthesisRunResponse,
  type NotebookBlockType,
} from "~/lib/api";
import { ExcalidrawViewer } from "~/components/synthesis/ExcalidrawViewer";
import { SynthesisSectionCard } from "~/components/synthesis/SynthesisSectionCard";
import { CitationText } from "~/components/synthesis/CitationText";
import { SynthesisRenderer } from "~/components/synthesis-v2";
import type { ComponentSpec, ThemeName } from "@rag-bookmarks/shared";

const searchSchema = z.object({
  q: z.string(),
  runId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/synthesis")({
  validateSearch: searchSchema,
  component: SynthesisPage,
});

const PHASE_MESSAGES: Record<SynthesisRunPhase, string> = {
  queued: "Queued for processing...",
  retrieval: "Searching your bookmarks...",
  map: "Extracting key insights...",
  reduce: "Synthesizing themes...",
  excalidraw: "Building visualization...",
  render: "Generating visual components...",
  visuals: "Creating visuals...",
  complete: "Complete",
  failed: "Run failed",
};

const NOTEBOOK_TYPE_LABELS: Record<NotebookBlockType, string> = {
  key_insight: "Key Insight",
  practical_takeaway: "Practical Takeaway",
  tradeoff: "Tradeoff",
  mental_model: "Mental Model",
  open_question: "Open Question",
};

type Status = "idle" | "loading" | "success" | "error";

interface NarrativeBlock {
  title: string | null;
  body: string;
}

function SynthesisPage() {
  const { q, runId: runIdFromSearch } = Route.useSearch();

  const [status, setStatus] = useState<Status>("idle");
  const [runData, setRunData] = useState<SynthesisRunResponse["data"] | null>(
    null
  );
  const [activeRunId, setActiveRunId] = useState<string | null>(
    runIdFromSearch ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const handleCreateRun = useCallback(async () => {
    const createResponse = await createSynthesisRun(q, 2); // Use V2 by default
    if (!createResponse.success || !createResponse.data) {
      throw new Error(createResponse.error?.message ?? "Failed to create run");
    }

    const runId = createResponse.data.runId;
    setActiveRunId(runId);
    replaceRunIdInUrl(q, runId);
  }, [q]);

  useEffect(() => {
    let cancelled = false;

    async function initializeRun() {
      setStatus("loading");
      setError(null);
      setRunData(null);

      if (runIdFromSearch) {
        setActiveRunId(runIdFromSearch);
        return;
      }

      try {
        await handleCreateRun();
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to create run");
        setStatus("error");
      }
    }

    void initializeRun();

    return () => {
      cancelled = true;
    };
  }, [handleCreateRun, runIdFromSearch]);

  useEffect(() => {
    const runId = activeRunId;
    if (!runId || status !== "loading") {
      return;
    }
    const runIdForPoll: string = runId;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function pollRun() {
      try {
        const response = await getSynthesisRun(runIdForPoll);
        if (!response.success || !response.data) {
          throw new Error(response.error?.message ?? "Failed to fetch run");
        }

        if (cancelled) {
          return;
        }

        setRunData(response.data);

        if (response.data.status === "complete") {
          setStatus("success");
          return;
        }

        if (response.data.status === "failed") {
          setError(response.data.error?.message ?? "Synthesis run failed");
          setStatus("error");
          return;
        }

        const pollAfterMs = response.data.pollAfterMs ?? 1500;
        timeoutId = setTimeout(() => {
          void pollRun();
        }, pollAfterMs);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to fetch run");
        setStatus("error");
      }
    }

    void pollRun();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeRunId, status]);

  const handleRetry = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setRunData(null);

    try {
      await handleCreateRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
      setStatus("error");
    }
  }, [handleCreateRun]);

  const isV2 = runData?.version === 2;
  const synthesis = runData?.result?.synthesis;
  const excalidraw = runData?.result?.excalidraw;
  const v2Components = runData?.components as ComponentSpec[] | undefined;
  const statusMessage = runData
    ? PHASE_MESSAGES[runData.phase]
    : "Preparing synthesis...";
  const trust = synthesis?.trust ?? {
    citationCoverage: 0,
    citedBlocks: 0,
    uncitedBlocks: 0,
    totalCitations: 0,
    sourceDiversity: 0,
  };
  const citationIndex = synthesis?.citationIndex ?? [];
  const citationsByIndex = new Map(
    citationIndex.map((entry) => [entry.index, entry])
  );
  const notebookBlocks = synthesis?.notebookBlocks ?? [];

  const narrativeBlocks = synthesis
    ? parseNarrativeBlocks(synthesis.narrativeMarkdown)
    : [];

  return (
    <div className="min-h-screen">
      <div className="relative pt-12 pb-8 px-4">
        <div className="mx-auto max-w-2xl">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>

          {status === "loading" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center min-h-[400px] gap-6"
            >
              <div className="relative h-10 w-10">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-amber-200"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{ borderTopColor: "rgb(217 119 6)" }}
                />
              </div>
              <p className="text-sm font-medium text-zinc-500">
                {statusMessage}
              </p>
              <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">
                Synthesizing &ldquo;{q}&rdquo;
              </p>
              {runData && (
                <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">
                  Progress: {runData.progress}%
                </p>
              )}
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center min-h-[300px] gap-4"
            >
              <p className="text-sm text-red-600 font-medium">
                {error || "Something went wrong."}
              </p>
              <button
                onClick={() => void handleRetry()}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </motion.div>
          )}

          {/* V2 Rendering with SynthesisRenderer */}
          {status === "success" && isV2 && v2Components && v2Components.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <SynthesisRenderer
                components={v2Components}
                theme={(runData?.result as { theme?: ThemeName } | undefined)?.theme ?? "default"}
              />
            </motion.div>
          )}

          {/* V1 Rendering (legacy) */}
          {status === "success" && (!isV2 || !v2Components || v2Components.length === 0) && synthesis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="text-3xl font-extrabold tracking-tight text-zinc-900"
                >
                  {synthesis.query}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mt-2 text-sm text-zinc-500"
                >
                  Synthesized from {synthesis.metadata.bookmarkCount} bookmarks
                  &middot; {synthesis.sections.length} sections
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="mt-1 text-xs text-zinc-500"
                >
                  Citation coverage: {Math.round(trust.citationCoverage * 100)}%
                  &middot; Sources used: {trust.sourceDiversity}
                </motion.p>
              </div>

              {narrativeBlocks.length > 0 && (
                <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
                  <h2 className="text-lg font-bold text-zinc-900">
                    Tutor Brief
                  </h2>
                  <div className="space-y-2">
                    {narrativeBlocks.map((block, idx) => (
                      <div
                        key={`${idx}-${block.title ?? block.body.slice(0, 20)}`}
                        className="space-y-1"
                      >
                        {block.title && (
                          <h3 className="text-sm font-semibold text-zinc-900">
                            {block.title}
                          </h3>
                        )}
                        <p className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">
                          <CitationText
                            text={block.body}
                            citationsByIndex={citationsByIndex}
                          />
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {notebookBlocks.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-lg font-bold text-zinc-900">
                    Learning Cards
                  </h2>
                  <div className="space-y-2">
                    {notebookBlocks.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-xl border border-zinc-200 bg-white p-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                            {NOTEBOOK_TYPE_LABELS[block.type]}
                          </span>
                          <h3 className="text-sm font-semibold text-zinc-900">
                            {block.title}
                          </h3>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm text-zinc-700 leading-relaxed">
                            <CitationText
                              text={block.insight}
                              citationsByIndex={citationsByIndex}
                            />
                          </p>
                          <p className="text-sm text-zinc-600 leading-relaxed">
                            <span className="font-semibold text-zinc-800">
                              Why it matters:
                            </span>
                            <CitationText
                              text={block.whyItMatters}
                              citationsByIndex={citationsByIndex}
                            />
                          </p>
                          <p className="text-sm text-zinc-600 leading-relaxed">
                            <span className="font-semibold text-zinc-800">
                              How to apply:
                            </span>
                            <CitationText
                              text={block.howToApply}
                              citationsByIndex={citationsByIndex}
                            />
                          </p>
                        </div>
                        {block.citations.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {block.citations.slice(0, 3).map((citation) => (
                              <a
                                key={`${block.id}-${citation.chunkId}`}
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-md border border-zinc-100 bg-zinc-50 px-2 py-1.5 hover:border-zinc-200 hover:bg-white transition-colors"
                              >
                                <p className="text-[11px] font-semibold text-zinc-700 truncate">
                                  {citation.title}
                                </p>
                                <p className="text-[11px] text-zinc-500 line-clamp-2">
                                  {truncateSnippet(citation.snippet)}
                                </p>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {citationIndex.length > 0 && (
                <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
                  <h2 className="text-lg font-bold text-zinc-900">Sources</h2>
                  <div className="space-y-1.5">
                    {citationIndex.map((reference) => (
                      <a
                        key={`${reference.index}-${reference.bookmarkId}`}
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-700 hover:border-zinc-200 hover:bg-white"
                      >
                        <span className="font-semibold text-zinc-800">
                          [{reference.index}]
                        </span>
                        <span className="line-clamp-2">{reference.title}</span>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {excalidraw && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                >
                  <ExcalidrawViewer initialData={excalidraw} />
                </motion.div>
              )}

              <div className="space-y-4">
                {synthesis.sections.map((section, index) => (
                  <SynthesisSectionCard
                    key={section.id}
                    section={section}
                    index={index}
                    citationIndex={citationIndex}
                  />
                ))}
              </div>

              {synthesis.deepDives.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 mb-3">
                    Deep Dives
                  </h2>
                  <div className="space-y-2">
                    {synthesis.deepDives.map((dive) => (
                      <motion.a
                        key={dive.bookmarkId}
                        href={dive.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 group-hover:text-amber-700 transition-colors truncate">
                            {dive.title}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                            {dive.reason}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                      </motion.a>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function parseNarrativeBlocks(markdown: string): NarrativeBlock[] {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return [];
  }

  const headingMatches = [...trimmed.matchAll(/^##\s+(.+)$/gm)];
  if (headingMatches.length === 0) {
    return trimmed
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
      .map((block) => ({ title: null, body: block }));
  }

  const blocks: NarrativeBlock[] = [];
  for (let i = 0; i < headingMatches.length; i += 1) {
    const current = headingMatches[i];
    const next = headingMatches[i + 1];
    if (!current) {
      continue;
    }

    const start = current.index ?? 0;
    const end = next?.index ?? trimmed.length;
    const sectionText = trimmed.slice(start, end).trim();
    const lines = sectionText.split("\n");
    const title = lines[0]?.replace(/^##\s+/, "").trim() ?? null;
    const body = lines.slice(1).join("\n").trim();

    if (!title && !body) {
      continue;
    }

    blocks.push({ title: title || null, body: body || title || "" });
  }

  return blocks;
}

function replaceRunIdInUrl(query: string, runId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("q", query);
  url.searchParams.set("runId", runId);
  window.history.replaceState(
    null,
    "",
    `${url.pathname}?${url.searchParams.toString()}`
  );
}

function truncateSnippet(snippet: string): string {
  if (snippet.length <= 180) {
    return snippet;
  }

  return `${snippet.slice(0, 177)}...`;
}
