import { z } from "zod";
import type { Entity, EntityMetadata } from "../db/schema.js";
import type { EntityRepository } from "../repositories/entities.js";
import type { LLMProvider } from "../providers/types.js";
import type { OpenLibraryProvider, BookCandidate } from "../providers/openlibrary.js";
import type { TMDBProvider, MovieCandidate, TvShowCandidate } from "../providers/tmdb.js";

const DISAMBIGUATION_THRESHOLD = 0.8; // If top candidate has popularity/score < this, disambiguate
const MIN_CONFIDENCE_THRESHOLD = 0.6; // Minimum LLM confidence to accept disambiguation

interface EnrichmentCandidate {
  entity: Entity;
  candidates: (BookCandidate | MovieCandidate | TvShowCandidate)[];
}

const disambiguationDecisionSchema = z.object({
  entityId: z.string(),
  selectedExternalId: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const disambiguationResponseSchema = z.object({
  decisions: z.array(disambiguationDecisionSchema),
});

/**
 * Enriches entities with metadata from external APIs
 */
export class EntityEnrichmentService {
  constructor(
    private entityRepo: EntityRepository,
    private openLibrary: OpenLibraryProvider,
    private tmdb: TMDBProvider,
    private llmProvider: LLMProvider
  ) {}

  /**
   * Enriches pending entities for a user
   */
  async enrichPendingEntities(userId: string): Promise<void> {
    const pendingEntities = await this.entityRepo.findPendingByUser(userId);

    if (pendingEntities.length === 0) {
      console.log(`No pending entities for user ${userId}`);
      return;
    }

    console.log(`Enriching ${pendingEntities.length} pending entities for user ${userId}`);

    // Group entities by type
    const books = pendingEntities.filter((e) => e.type === "book");
    const movies = pendingEntities.filter((e) => e.type === "movie");
    const tvShows = pendingEntities.filter((e) => e.type === "tv_show");

    // Enrich each group
    const enrichmentCandidates: EnrichmentCandidate[] = [];

    // Enrich books
    for (const entity of books) {
      try {
        const candidates = await this.openLibrary.searchBooks(entity.name);
        enrichmentCandidates.push({ entity, candidates });
      } catch (error) {
        console.error(`Failed to enrich book "${entity.name}":`, error);
        await this.markAsFailed(entity, String(error));
      }
    }

    // Enrich movies
    for (const entity of movies) {
      try {
        const candidates = await this.tmdb.searchMovies(entity.name);
        enrichmentCandidates.push({ entity, candidates });
      } catch (error) {
        console.error(`Failed to enrich movie "${entity.name}":`, error);
        await this.markAsFailed(entity, String(error));
      }
    }

    // Enrich TV shows
    for (const entity of tvShows) {
      try {
        const candidates = await this.tmdb.searchTvShows(entity.name);
        enrichmentCandidates.push({ entity, candidates });
      } catch (error) {
        console.error(`Failed to enrich TV show "${entity.name}":`, error);
        await this.markAsFailed(entity, String(error));
      }
    }

    // Process candidates: auto-enrich clear matches, disambiguate ambiguous ones
    const clearMatches: Array<{ entity: Entity; candidate: BookCandidate | MovieCandidate | TvShowCandidate }> = [];
    const ambiguousCandidates: EnrichmentCandidate[] = [];

    for (const enrichmentCandidate of enrichmentCandidates) {
      const { entity, candidates } = enrichmentCandidate;

      if (candidates.length === 0) {
        await this.markAsFailed(entity, "No candidates found");
        continue;
      }

      if (candidates.length === 1) {
        // Single candidate - auto-enrich
        clearMatches.push({ entity, candidate: candidates[0]! });
        continue;
      }

      // Multiple candidates - check if top candidate is clearly the best
      const sorted = this.sortCandidatesByRelevance(candidates);
      const topCandidate = sorted[0]!;
      const secondCandidate = sorted[1];

      // For TMDB, use popularity score
      const isMovieOrTv = entity.type === "movie" || entity.type === "tv_show";
      if (isMovieOrTv && "popularity" in topCandidate && secondCandidate && "popularity" in secondCandidate) {
        const popularityRatio = topCandidate.popularity / secondCandidate.popularity;
        if (popularityRatio > 2.0) {
          // Top candidate is significantly more popular
          clearMatches.push({ entity, candidate: topCandidate });
          continue;
        }
      }

      // Needs disambiguation
      ambiguousCandidates.push(enrichmentCandidate);
    }

    // Auto-enrich clear matches
    for (const { entity, candidate } of clearMatches) {
      await this.enrichEntity(entity, candidate);
    }

    // Disambiguate ambiguous candidates
    if (ambiguousCandidates.length > 0) {
      await this.disambiguateEntities(ambiguousCandidates);
    }

    console.log(`Enrichment complete: ${clearMatches.length} clear, ${ambiguousCandidates.length} disambiguated`);
  }

  /**
   * Sort candidates by relevance (popularity for TMDB, order for Open Library)
   */
  private sortCandidatesByRelevance(
    candidates: (BookCandidate | MovieCandidate | TvShowCandidate)[]
  ): (BookCandidate | MovieCandidate | TvShowCandidate)[] {
    return [...candidates].sort((a, b) => {
      // For TMDB candidates, sort by popularity
      if ("popularity" in a && "popularity" in b) {
        return b.popularity - a.popularity;
      }
      // For Open Library, trust the order returned by the API
      return 0;
    });
  }

  /**
   * Disambiguate entities using LLM
   */
  private async disambiguateEntities(
    enrichmentCandidates: EnrichmentCandidate[]
  ): Promise<void> {
    // Build disambiguation prompt
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

      // Process disambiguation decisions
      for (const decision of result.decisions) {
        const enrichmentCandidate = enrichmentCandidates.find(
          (ec) => ec.entity.id === decision.entityId
        );

        if (!enrichmentCandidate) {
          console.warn(`Disambiguation decision for unknown entity: ${decision.entityId}`);
          continue;
        }

        const { entity, candidates } = enrichmentCandidate;

        if (decision.confidence < MIN_CONFIDENCE_THRESHOLD || !decision.selectedExternalId) {
          // Mark as ambiguous, store candidates for future resolution
          await this.markAsAmbiguous(entity, candidates, decision.reasoning);
          continue;
        }

        // Find selected candidate
        const selectedCandidate = candidates.find(
          (c) => c.externalId === decision.selectedExternalId
        );

        if (!selectedCandidate) {
          console.warn(
            `Selected candidate not found: ${decision.selectedExternalId} for entity ${entity.id}`
          );
          await this.markAsAmbiguous(entity, candidates, "Selected candidate not found");
          continue;
        }

        // Enrich with selected candidate
        await this.enrichEntity(entity, selectedCandidate);
        console.log(
          `Disambiguated entity "${entity.name}" → ${selectedCandidate.title} (confidence: ${decision.confidence})`
        );
      }
    } catch (error) {
      console.error("Disambiguation failed:", error);
      // Mark all as failed
      for (const { entity } of enrichmentCandidates) {
        await this.markAsFailed(entity, "Disambiguation failed");
      }
    }
  }

  /**
   * Build disambiguation prompt for LLM
   */
  private buildDisambiguationPrompt(enrichmentCandidates: EnrichmentCandidate[]): string {
    const entityBlocks = enrichmentCandidates.map((ec) => {
      const { entity, candidates } = ec;

      const candidatesText = candidates
        .map((c, idx) => {
          if (entity.type === "book") {
            const book = c as BookCandidate;
            return `  ${idx + 1}. ${book.externalId}
     Title: ${book.title}
     Authors: ${book.authors.join(", ") || "Unknown"}
     Year: ${book.year || "Unknown"}`;
          } else if (entity.type === "movie") {
            const movie = c as MovieCandidate;
            return `  ${idx + 1}. ${movie.externalId}
     Title: ${movie.title}
     Directors: ${movie.directors?.join(", ") || "Unknown"}
     Year: ${movie.year || "Unknown"}
     Popularity: ${movie.popularity}`;
          } else {
            const tv = c as TvShowCandidate;
            return `  ${idx + 1}. ${tv.externalId}
     Title: ${tv.title}
     Creators: ${tv.creators?.join(", ") || "Unknown"}
     First Air Year: ${tv.firstAirYear || "Unknown"}
     Popularity: ${tv.popularity}`;
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

  /**
   * Enrich entity with candidate metadata
   */
  private async enrichEntity(
    entity: Entity,
    candidate: BookCandidate | MovieCandidate | TvShowCandidate
  ): Promise<void> {
    let metadata: EntityMetadata;

    if (entity.type === "book") {
      const book = candidate as BookCandidate;
      metadata = {
        canonical_title: book.title,
        authors: book.authors,
        openlibrary_key: book.externalId.replace("openlibrary:", ""),
      };
      if (book.coverUrl) (metadata as any).cover_url = book.coverUrl;
      if (book.year) (metadata as any).year = book.year;
      if (book.isbn) (metadata as any).isbn = book.isbn;
      if (book.pageCount) (metadata as any).page_count = book.pageCount;
      if (book.subjects) (metadata as any).subjects = book.subjects;
    } else if (entity.type === "movie") {
      const movie = candidate as MovieCandidate;
      metadata = {
        canonical_title: movie.title,
        tmdb_id: movie.tmdbId,
        genres: movie.genres,
      };
      if (movie.directors) (metadata as any).directors = movie.directors;
      if (movie.posterUrl) (metadata as any).poster_url = movie.posterUrl;
      if (movie.year) (metadata as any).year = movie.year;
      if (movie.imdbId) (metadata as any).imdb_id = movie.imdbId;
      if (movie.runtime) (metadata as any).runtime = movie.runtime;
    } else {
      const tv = candidate as TvShowCandidate;
      metadata = {
        canonical_title: tv.title,
        tmdb_id: tv.tmdbId,
        genres: tv.genres,
      };
      if (tv.creators) (metadata as any).creators = tv.creators;
      if (tv.posterUrl) (metadata as any).poster_url = tv.posterUrl;
      if (tv.firstAirYear) (metadata as any).first_air_year = tv.firstAirYear;
      if (tv.seasons) (metadata as any).seasons = tv.seasons;
    }

    await this.entityRepo.updateMetadata(entity.id, metadata, "enriched", candidate.externalId);
    console.log(`Enriched entity "${entity.name}" → ${candidate.title}`);
  }

  /**
   * Mark entity as ambiguous
   */
  private async markAsAmbiguous(
    entity: Entity,
    candidates: (BookCandidate | MovieCandidate | TvShowCandidate)[],
    reason: string
  ): Promise<void> {
    const metadata: EntityMetadata = {
      error: reason,
      candidates: candidates.map((c) => ({
        externalId: c.externalId,
        title: c.title,
      })),
    } as any;

    await this.entityRepo.updateMetadata(entity.id, metadata, "ambiguous");
    console.log(`Marked entity "${entity.name}" as ambiguous: ${reason}`);
  }

  /**
   * Mark entity as failed
   */
  private async markAsFailed(entity: Entity, error: string): Promise<void> {
    const metadata: EntityMetadata = {
      error,
    } as any;

    await this.entityRepo.updateMetadata(entity.id, metadata, "failed");
    console.log(`Marked entity "${entity.name}" as failed: ${error}`);
  }
}
