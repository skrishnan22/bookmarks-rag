import { z } from "zod";
import pLimit from "p-limit";
import type {
  Entity,
  EntityMetadata,
  AmbiguousMetadata,
  FailedMetadata,
  SearchCandidates,
  SearchCandidate,
  ExtractionHints,
} from "../db/schema.js";
import type { EntityRepository } from "../repositories/entities.js";
import type { LLMProvider } from "../providers/types.js";
import type {
  OpenLibraryProvider,
  BookCandidate,
} from "../providers/openlibrary.js";
import type {
  TMDBProvider,
  MovieCandidate,
  TvShowCandidate,
} from "../providers/tmdb.js";

const API_CONCURRENCY = 3;

const MIN_CONFIDENCE_THRESHOLD = 0.6;

// Discriminated union - TypeScript can narrow based on `kind`
type Candidate = BookCandidate | MovieCandidate | TvShowCandidate;

interface EnrichmentCandidate {
  entity: Entity;
  candidates: Candidate[];
  hints?: ExtractionHints | undefined;
}

interface ClearMatch {
  entity: Entity;
  candidate: Candidate;
}

interface CategorizedMatches {
  clearMatches: ClearMatch[];
  ambiguous: EnrichmentCandidate[];
}

function candidateToSearchCandidate(candidate: Candidate): SearchCandidate {
  return {
    externalId: candidate.externalId,
    title: candidate.title,
    confidence: "popularity" in candidate ? candidate.popularity / 100 : 0.5,
    metadata: candidate as unknown as Record<string, unknown>,
  };
}

function searchCandidateToCandidate(
  sc: SearchCandidate,
  entityType: string
): Candidate {
  return sc.metadata as unknown as Candidate;
}

const disambiguationDecisionSchema = z.object({
  entityId: z.string(),
  selectedExternalId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const disambiguationResponseSchema = z.object({
  decisions: z.array(disambiguationDecisionSchema),
});

export class EntityEnrichmentService {
  constructor(
    private entityRepo: EntityRepository,
    private openLibrary: OpenLibraryProvider,
    private tmdb: TMDBProvider,
    private llmProvider: LLMProvider
  ) {}

  async enrichEntitiesForBookmark(
    userId: string,
    bookmarkId: string
  ): Promise<void> {
    const entitiesToProcess =
      await this.entityRepo.findPendingEntitiesForBookmark(userId, bookmarkId);

    if (entitiesToProcess.length === 0) {
      console.log(
        `[enrichment] Bookmark ${bookmarkId}: No PENDING entities to enrich`
      );
      return;
    }

    console.log(
      `[enrichment] Bookmark ${bookmarkId}: Processing ${entitiesToProcess.length} entities`
    );

    await this.enrichEntities(entitiesToProcess);
  }

  async enrichPendingEntities(userId: string): Promise<void> {
    const pendingEntities = await this.entityRepo.findByStatus(
      userId,
      "PENDING"
    );
    const candidatesFoundEntities = await this.entityRepo.findByStatus(
      userId,
      "CANDIDATES_FOUND"
    );

    const entitiesToProcess = [...pendingEntities, ...candidatesFoundEntities];

    if (entitiesToProcess.length === 0) {
      console.log(`No entities to process for user ${userId}`);
      return;
    }

    console.log(
      `[enrichment] User ${userId}: Processing ${entitiesToProcess.length} entities`
    );

    await this.enrichEntities(entitiesToProcess);
  }

  private async enrichEntities(entitiesToProcess: Entity[]): Promise<void> {
    const limit = pLimit(API_CONCURRENCY);

    const enrichmentCandidates = await this.buildEnrichmentCandidates(
      entitiesToProcess,
      limit
    );

    if (enrichmentCandidates.length === 0) {
      console.log(`No entities with candidates to process`);
      return;
    }

    console.log(
      `[Phase 2] Processing ${enrichmentCandidates.length} entities with candidates`
    );

    const { clearMatches, ambiguous } =
      await this.categorizeMatches(enrichmentCandidates);

    await this.processClearMatches(clearMatches, limit);

    if (ambiguous.length > 0) {
      await this.disambiguateEntities(ambiguous, limit);
    }

    console.log(
      `Enrichment complete: ${clearMatches.length} clear, ${ambiguous.length} disambiguated`
    );
  }

  private async buildEnrichmentCandidates(
    entitiesToProcess: Entity[],
    limit: ReturnType<typeof pLimit>
  ): Promise<EnrichmentCandidate[]> {
    const pendingEntities = entitiesToProcess.filter(
      (e) => e.status === "PENDING"
    );
    const entitiesWithCandidates = entitiesToProcess.filter(
      (e) => e.status === "CANDIDATES_FOUND"
    );

    const candidatesMap = new Map<string, Candidate[]>();

    if (pendingEntities.length > 0) {
      console.log(
        `[Phase 1] Searching APIs for ${pendingEntities.length} pending entities`
      );
      const searchResults = await this.searchAndStoreCandidates(
        pendingEntities,
        limit
      );

      for (const [entityId, candidates] of searchResults) {
        candidatesMap.set(entityId, candidates);
      }
    }

    const enrichmentCandidates: EnrichmentCandidate[] = [];

    // Add pending entities that got candidates from API search
    for (const entity of pendingEntities) {
      const candidates = candidatesMap.get(entity.id);
      if (candidates) {
        const hints = await this.getFirstHintsForEntity(entity.id);
        enrichmentCandidates.push({ entity, candidates, hints });
      }
    }

    // Add entities that already had CANDIDATES_FOUND status (from previous runs)
    for (const entity of entitiesWithCandidates) {
      if (!entity.searchCandidates?.results) {
        console.warn(`Entity ${entity.id} has no stored candidates, skipping`);
        await this.markAsFailed(entity, "No stored candidates found");
        continue;
      }

      const candidates = entity.searchCandidates.results.map((sc) =>
        searchCandidateToCandidate(sc, entity.type)
      );
      const hints = await this.getFirstHintsForEntity(entity.id);
      enrichmentCandidates.push({ entity, candidates, hints });
    }

    return enrichmentCandidates;
  }

  private async getFirstHintsForEntity(
    entityId: string
  ): Promise<ExtractionHints | undefined> {
    const contexts = await this.entityRepo.getExtractionHintsForEntity(entityId);
    // Return the first non-null hints found
    for (const ctx of contexts) {
      if (ctx.extractionHints) {
        return ctx.extractionHints;
      }
    }
    return undefined;
  }

  private async categorizeMatches(
    enrichmentCandidates: EnrichmentCandidate[]
  ): Promise<CategorizedMatches> {
    const clearMatches: ClearMatch[] = [];
    const ambiguous: EnrichmentCandidate[] = [];

    for (const enrichmentCandidate of enrichmentCandidates) {
      const { entity, candidates } = enrichmentCandidate;

      if (candidates.length === 0) {
        await this.markAsFailed(entity, "No candidates found");
        continue;
      }

      if (candidates.length === 1) {
        clearMatches.push({ entity, candidate: candidates[0]! });
        continue;
      }

      const sorted = this.sortCandidatesByRelevance(candidates);
      const topCandidate = sorted[0]!;
      const secondCandidate = sorted[1];

      // For movies/tv, use popularity ratio to determine clear match
      const isMovieOrTv = entity.type === "movie" || entity.type === "tv_show";
      if (
        isMovieOrTv &&
        "popularity" in topCandidate &&
        secondCandidate &&
        "popularity" in secondCandidate
      ) {
        const popularityRatio =
          topCandidate.popularity / secondCandidate.popularity;
        if (popularityRatio > 2.0) {
          clearMatches.push({ entity, candidate: topCandidate });
          continue;
        }
      }

      ambiguous.push(enrichmentCandidate);
    }

    return { clearMatches, ambiguous };
  }

  private async processClearMatches(
    clearMatches: ClearMatch[],
    limit: ReturnType<typeof pLimit>
  ): Promise<void> {
    await Promise.all(
      clearMatches.map(({ entity, candidate }) =>
        limit(() => this.enrichEntity(entity, candidate))
      )
    );
  }

  private async searchAndStoreCandidates(
    entities: Entity[],
    limit: ReturnType<typeof pLimit>
  ): Promise<Map<string, Candidate[]>> {
    const resultsMap = new Map<string, Candidate[]>();

    const tasks = entities.map((entity) =>
      limit(async () => {
        try {
          let candidates: Candidate[];
          let provider: "openlibrary" | "tmdb";

          if (entity.type === "book") {
            candidates = await this.openLibrary.searchBooks(entity.name);
            provider = "openlibrary";
          } else if (entity.type === "movie") {
            candidates = await this.tmdb.searchMovies(entity.name);
            provider = "tmdb";
          } else {
            candidates = await this.tmdb.searchTvShows(entity.name);
            provider = "tmdb";
          }

          // Store candidates on entity (for resumability)
          const searchCandidates: SearchCandidates = {
            provider,
            searchedAt: new Date().toISOString(),
            results: candidates.map(candidateToSearchCandidate),
          };

          await this.entityRepo.updateSearchCandidates(
            entity.id,
            searchCandidates
          );
          await this.entityRepo.updateStatus(entity.id, "CANDIDATES_FOUND");

          // Store in map to avoid re-fetching
          resultsMap.set(entity.id, candidates);

          console.log(
            `[search] Entity "${entity.name}": Found ${candidates.length} candidates`
          );
        } catch (error) {
          console.error(
            `Failed to fetch candidates for ${entity.type} "${entity.name}":`,
            error
          );
          await this.markAsFailed(entity, String(error));
        }
      })
    );

    await Promise.all(tasks);

    return resultsMap;
  }

  private sortCandidatesByRelevance(candidates: Candidate[]): Candidate[] {
    return [...candidates].sort((a, b) => {
      if ("popularity" in a && "popularity" in b) {
        return b.popularity - a.popularity;
      }
      return 0;
    });
  }

  private async disambiguateEntities(
    enrichmentCandidates: EnrichmentCandidate[],
    limit: ReturnType<typeof pLimit>
  ): Promise<void> {
    const systemPrompt = `You are a disambiguation assistant. Given an entity name, its context, and multiple candidates from external APIs, select the most likely match.

Rules:
1. Prefer recency when context has no signals (users more likely discussing recent works)
2. Prefer popularity as tiebreaker
3. Match language of content to work's original language when possible
4. Author/director/creator match is a strong signal - prioritize if mentioned
5. Year match in context is a strong signal

Return confidence score:
- >0.8: Very confident match
- 0.6-0.8: Reasonable match
- <0.6: Uncertain (will be marked ambiguous)

If no good match exists, set confidence < 0.6 and leave selectedExternalId empty.`;

    const userPrompt = this.buildDisambiguationPrompt(enrichmentCandidates);

    try {
      const result = await this.llmProvider.generateObject(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        disambiguationResponseSchema,
        { temperature: 0.1, maxTokens: 4000 } //TODO=> move to constants
      );

      // Process disambiguation decisions in parallel
      await Promise.all(
        result.decisions.map((decision) =>
          limit(async () => {
            const enrichmentCandidate = enrichmentCandidates.find(
              (ec) => ec.entity.id === decision.entityId
            );

            if (!enrichmentCandidate) {
              console.warn(
                `Disambiguation decision for unknown entity: ${decision.entityId}`
              );
              return;
            }

            const { entity, candidates } = enrichmentCandidate;

            if (
              decision.confidence < MIN_CONFIDENCE_THRESHOLD ||
              !decision.selectedExternalId
            ) {
              await this.markAsAmbiguous(
                entity,
                candidates,
                decision.reasoning
              );
              return;
            }

            const selectedCandidate = candidates.find(
              (c) => c.externalId === decision.selectedExternalId
            );

            if (!selectedCandidate) {
              console.warn(
                `Selected candidate not found: ${decision.selectedExternalId} for entity ${entity.id}`
              );
              await this.markAsAmbiguous(
                entity,
                candidates,
                "Selected candidate not found"
              );
              return;
            }

            await this.enrichEntity(entity, selectedCandidate);
            console.log(
              `Disambiguated entity "${entity.name}" → ${selectedCandidate.title} (confidence: ${decision.confidence})`
            );
          })
        )
      );
    } catch (error) {
      console.error("Disambiguation failed:", error);
      await Promise.all(
        enrichmentCandidates.map(({ entity }) =>
          limit(() => this.markAsFailed(entity, "Disambiguation failed"))
        )
      );
    }
  }

  private buildDisambiguationPrompt(
    enrichmentCandidates: EnrichmentCandidate[]
  ): string {
    const entityBlocks = enrichmentCandidates.map((ec) => {
      const { entity, candidates, hints } = ec;

      const candidatesText = candidates
        .map((c, idx) => {
          // Use discriminant for type narrowing - no casts needed
          switch (c.kind) {
            case "book":
              return `  ${idx + 1}. ${c.externalId}
     Title: ${c.title}
     Authors: ${c.authors.join(", ") || "Unknown"}
     Year: ${c.year || "Unknown"}`;
            case "movie":
              return `  ${idx + 1}. ${c.externalId}
     Title: ${c.title}
     Directors: ${c.directors?.join(", ") || "Unknown"}
     Year: ${c.year || "Unknown"}
     Popularity: ${c.popularity}`;
            case "tv_show":
              return `  ${idx + 1}. ${c.externalId}
     Title: ${c.title}
     Creators: ${c.creators?.join(", ") || "Unknown"}
     First Air Year: ${c.firstAirYear || "Unknown"}
     Popularity: ${c.popularity}`;
          }
        })
        .join("\n\n");

      // Build hints text if available
      const hintsText = this.formatHints(hints);

      return `Entity ID: ${entity.id}
Type: ${entity.type}
Name: "${entity.name}"${hintsText}

Candidates:
${candidatesText}`;
    });

    return `Disambiguate the following entities by selecting the best matching candidate for each:

${entityBlocks.join("\n\n---\n\n")}

For each entity, provide:
- entityId: The entity ID
- selectedExternalId: The external ID of the best matching candidate (or null if no good match)
- confidence: Your confidence score (0.0-1.0)
- reasoning: Brief explanation of your choice`;
  }

  private formatHints(hints?: ExtractionHints | undefined): string {
    if (!hints) return "";

    const parts: string[] = [];
    if (hints.year !== null) parts.push(`Year: ${hints.year}`);
    if (hints.author !== null) parts.push(`Author: ${hints.author}`);
    if (hints.director !== null) parts.push(`Director: ${hints.director}`);
    if (hints.language !== null) parts.push(`Language: ${hints.language}`);

    if (parts.length === 0) return "";
    return `\nContext Hints: ${parts.join(", ")}`;
  }

  private async enrichEntity(
    entity: Entity,
    candidate: Candidate
  ): Promise<void> {
    const metadata = this.buildMetadata(candidate);
    await this.entityRepo.updateMetadata(
      entity.id,
      metadata,
      "ENRICHED",
      candidate.externalId
    );
    console.log(`Enriched entity "${entity.name}" → ${candidate.title}`);
  }

  private buildMetadata(candidate: Candidate): EntityMetadata {
    switch (candidate.kind) {
      case "book":
        return {
          canonical_title: candidate.title,
          authors: candidate.authors,
          openlibrary_key: candidate.externalId.replace("openlibrary:", ""),
          ...(candidate.coverUrl && { cover_url: candidate.coverUrl }),
          ...(candidate.year && { year: candidate.year }),
          ...(candidate.isbn && { isbn: candidate.isbn }),
          ...(candidate.pageCount && { page_count: candidate.pageCount }),
          ...(candidate.subjects && { subjects: candidate.subjects }),
        };

      case "movie":
        return {
          canonical_title: candidate.title,
          tmdb_id: candidate.tmdbId,
          ...(candidate.genres && { genres: candidate.genres }),
          ...(candidate.directors && { directors: candidate.directors }),
          ...(candidate.posterUrl && { poster_url: candidate.posterUrl }),
          ...(candidate.year && { year: candidate.year }),
          ...(candidate.imdbId && { imdb_id: candidate.imdbId }),
          ...(candidate.runtime && { runtime: candidate.runtime }),
        };

      case "tv_show":
        return {
          canonical_title: candidate.title,
          tmdb_id: candidate.tmdbId,
          ...(candidate.genres && { genres: candidate.genres }),
          ...(candidate.creators && { creators: candidate.creators }),
          ...(candidate.posterUrl && { poster_url: candidate.posterUrl }),
          ...(candidate.firstAirYear && {
            first_air_year: candidate.firstAirYear,
          }),
          ...(candidate.seasons && { seasons: candidate.seasons }),
        };
    }
  }

  private async markAsAmbiguous(
    entity: Entity,
    candidates: Candidate[],
    reason: string
  ): Promise<void> {
    const metadata: AmbiguousMetadata = {
      error: reason,
      candidates: candidates.map((c) => ({
        externalId: c.externalId,
        title: c.title,
      })),
    };

    await this.entityRepo.updateMetadata(entity.id, metadata, "AMBIGUOUS");
    console.log(`Marked entity "${entity.name}" as ambiguous: ${reason}`);
  }

  private async markAsFailed(entity: Entity, error: string): Promise<void> {
    const metadata: FailedMetadata = { error };

    await this.entityRepo.updateMetadata(entity.id, metadata, "FAILED");
    console.log(`Marked entity "${entity.name}" as failed: ${error}`);
  }
}
