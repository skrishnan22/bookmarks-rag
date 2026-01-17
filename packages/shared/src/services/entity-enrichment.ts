import { z } from "zod";
import pLimit from "p-limit";
import type {
  Entity,
  EntityMetadata,
  AmbiguousMetadata,
  FailedMetadata,
  SearchCandidates,
  SearchCandidate,
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
  return sc.metadata as Candidate;
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

  async enrichPendingEntities(userId: string): Promise<void> {
    const limit = pLimit(API_CONCURRENCY);

    // Phase 1: Search APIs for pending entities and store candidates
    const pendingEntities = await this.entityRepo.findByStatus(
      userId,
      "pending"
    );

    if (pendingEntities.length > 0) {
      console.log(
        `[Phase 1] Searching APIs for ${pendingEntities.length} pending entities`
      );
      await this.searchAndStoreCandidates(pendingEntities, limit);
    }

    // Phase 2: Process all entities with stored candidates
    const entitiesWithCandidates = await this.entityRepo.findByStatus(
      userId,
      "candidates_found"
    );

    if (entitiesWithCandidates.length === 0) {
      console.log(`No entities with candidates to process for user ${userId}`);
      return;
    }

    console.log(
      `[Phase 2] Processing ${entitiesWithCandidates.length} entities with candidates`
    );

    // Build enrichment candidates from stored data
    const enrichmentCandidates: EnrichmentCandidate[] = [];
    for (const entity of entitiesWithCandidates) {
      if (!entity.searchCandidates?.results) {
        console.warn(`Entity ${entity.id} has no stored candidates, skipping`);
        await this.markAsFailed(entity, "No stored candidates found");
        continue;
      }

      const candidates = entity.searchCandidates.results.map((sc) =>
        searchCandidateToCandidate(sc, entity.type)
      );
      enrichmentCandidates.push({ entity, candidates });
    }

    const clearMatches: Array<{
      entity: Entity;
      candidate: Candidate;
    }> = [];
    const ambiguousCandidates: EnrichmentCandidate[] = [];

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

      ambiguousCandidates.push(enrichmentCandidate);
    }

    // Enrich clear matches in parallel
    await Promise.all(
      clearMatches.map(({ entity, candidate }) =>
        limit(() => this.enrichEntity(entity, candidate))
      )
    );

    if (ambiguousCandidates.length > 0) {
      await this.disambiguateEntities(ambiguousCandidates, limit);
    }

    console.log(
      `Enrichment complete: ${clearMatches.length} clear, ${ambiguousCandidates.length} disambiguated`
    );
  }

  private async searchAndStoreCandidates(
    entities: Entity[],
    limit: ReturnType<typeof pLimit>
  ): Promise<void> {
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

          // Store candidates on entity
          const searchCandidates: SearchCandidates = {
            provider,
            searchedAt: new Date().toISOString(),
            results: candidates.map(candidateToSearchCandidate),
          };

          await this.entityRepo.updateSearchCandidates(
            entity.id,
            searchCandidates
          );
          await this.entityRepo.updateStatus(entity.id, "candidates_found");

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
        { temperature: 0.1, maxTokens: 4000 }
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
      // Mark all as failed in parallel
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
      const { entity, candidates } = ec;

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

      return `Entity ID: ${entity.id}
Type: ${entity.type}
Name: "${entity.name}"

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

  private async enrichEntity(
    entity: Entity,
    candidate: Candidate
  ): Promise<void> {
    const metadata = this.buildMetadata(candidate);
    await this.entityRepo.updateMetadata(
      entity.id,
      metadata,
      "enriched",
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

    await this.entityRepo.updateMetadata(entity.id, metadata, "ambiguous");
    console.log(`Marked entity "${entity.name}" as ambiguous: ${reason}`);
  }

  private async markAsFailed(entity: Entity, error: string): Promise<void> {
    const metadata: FailedMetadata = { error };

    await this.entityRepo.updateMetadata(entity.id, metadata, "failed");
    console.log(`Marked entity "${entity.name}" as failed: ${error}`);
  }
}
