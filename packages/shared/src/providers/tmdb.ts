/**
 * TMDB provider for movie and TV show metadata enrichment
 */
import { z } from "zod";

// Zod schemas for API response validation
const tmdbGenreSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const tmdbMovieResultSchema = z.object({
  id: z.number(),
  title: z.string(),
  release_date: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  popularity: z.number(),
  genre_ids: z.array(z.number()),
});

const tmdbTvResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  first_air_date: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  popularity: z.number(),
  genre_ids: z.array(z.number()),
});

const tmdbMovieSearchResponseSchema = z.object({
  results: z.array(tmdbMovieResultSchema),
  total_results: z.number(),
});

const tmdbTvSearchResponseSchema = z.object({
  results: z.array(tmdbTvResultSchema),
  total_results: z.number(),
});

const tmdbMovieDetailsSchema = z.object({
  id: z.number(),
  title: z.string(),
  release_date: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  popularity: z.number(),
  imdb_id: z.string().nullable().optional(),
  runtime: z.number().nullable().optional(),
  genres: z.array(tmdbGenreSchema),
});

const tmdbTvDetailsSchema = z.object({
  id: z.number(),
  name: z.string(),
  first_air_date: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  popularity: z.number(),
  number_of_seasons: z.number().optional(),
  genres: z.array(tmdbGenreSchema),
  created_by: z.array(z.object({ name: z.string() })),
});

const tmdbMovieCreditsResponseSchema = z.object({
  crew: z.array(
    z.object({
      job: z.string(),
      name: z.string(),
    })
  ),
});

const tmdbErrorResponseSchema = z.object({
  status_message: z.string().optional(),
});

export interface MovieCandidate {
  kind: "movie"; // Discriminant for type narrowing
  externalId: string;
  title: string;
  directors?: string[];
  year?: number;
  posterUrl?: string;
  tmdbId: number;
  imdbId?: string;
  runtime?: number;
  genres?: string[];
  popularity: number;
}

export interface TvShowCandidate {
  kind: "tv_show"; // Discriminant for type narrowing
  externalId: string;
  title: string;
  creators?: string[];
  firstAirYear?: number;
  posterUrl?: string;
  tmdbId: number;
  seasons?: number;
  genres?: string[];
  popularity: number;
}

export class TMDBProvider {
  private baseUrl = "https://api.themoviedb.org/3";
  private imageBaseUrl = "https://image.tmdb.org/t/p/w500";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchMovies(
    query: string,
    limit: number = 5
  ): Promise<MovieCandidate[]> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      query,
      include_adult: "false",
    });

    const response = await fetch(`${this.baseUrl}/search/movie?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    const json = await response.json();
    const data = tmdbMovieSearchResponseSchema.parse(json);
    const topResults = data.results.slice(0, limit);

    const candidates = await Promise.all(
      topResults.map((movie) => this.getMovieDetails(movie.id))
    );

    return candidates;
  }

  async searchTvShows(
    query: string,
    limit: number = 5
  ): Promise<TvShowCandidate[]> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      query,
      include_adult: "false",
    });

    const response = await fetch(`${this.baseUrl}/search/tv?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    const json = await response.json();
    const data = tmdbTvSearchResponseSchema.parse(json);
    const topResults = data.results.slice(0, limit);

    const candidates = await Promise.all(
      topResults.map((show) => this.getTvShowDetails(show.id))
    );

    return candidates;
  }

  private async getMovieDetails(movieId: number): Promise<MovieCandidate> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
    });

    const detailsResponse = await fetch(
      `${this.baseUrl}/movie/${movieId}?${params}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!detailsResponse.ok) {
      await this.handleError(detailsResponse);
    }

    const detailsJson = await detailsResponse.json();
    const details = tmdbMovieDetailsSchema.parse(detailsJson);

    const creditsResponse = await fetch(
      `${this.baseUrl}/movie/${movieId}/credits?${params}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    let directors: string[] = [];
    if (creditsResponse.ok) {
      const creditsJson = await creditsResponse.json();
      const creditsResult = tmdbMovieCreditsResponseSchema.safeParse(creditsJson);
      if (creditsResult.success) {
        directors = creditsResult.data.crew
          .filter((member) => member.job === "Director")
          .map((member) => member.name);
      }
    }

    const candidate: MovieCandidate = {
      kind: "movie",
      externalId: `tmdb:${details.id}`,
      title: details.title,
      tmdbId: details.id,
      genres: details.genres.map((g) => g.name),
      popularity: details.popularity,
    };

    if (directors.length > 0) candidate.directors = directors;
    if (details.release_date) {
      candidate.year = new Date(details.release_date).getFullYear();
    }
    if (details.poster_path) {
      candidate.posterUrl = `${this.imageBaseUrl}${details.poster_path}`;
    }
    if (details.imdb_id) candidate.imdbId = details.imdb_id;
    if (details.runtime) candidate.runtime = details.runtime;

    return candidate;
  }

  private async getTvShowDetails(showId: number): Promise<TvShowCandidate> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
    });

    const response = await fetch(`${this.baseUrl}/tv/${showId}?${params}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    const json = await response.json();
    const details = tmdbTvDetailsSchema.parse(json);

    const candidate: TvShowCandidate = {
      kind: "tv_show",
      externalId: `tmdb:${details.id}`,
      title: details.name,
      tmdbId: details.id,
      genres: details.genres.map((g) => g.name),
      popularity: details.popularity,
    };

    if (details.created_by.length > 0) {
      candidate.creators = details.created_by.map((c) => c.name);
    }
    if (details.first_air_date) {
      candidate.firstAirYear = new Date(details.first_air_date).getFullYear();
    }
    if (details.poster_path) {
      candidate.posterUrl = `${this.imageBaseUrl}${details.poster_path}`;
    }
    if (details.number_of_seasons) {
      candidate.seasons = details.number_of_seasons;
    }

    return candidate;
  }

  private async handleError(response: Response): Promise<never> {
    const errorJson = await response.json().catch(() => ({}));
    const errorResult = tmdbErrorResponseSchema.safeParse(errorJson);
    const errorMessage = errorResult.success
      ? errorResult.data.status_message
      : undefined;

    if (response.status === 429) {
      throw new Error("TMDB rate limit exceeded");
    }

    if (response.status === 401) {
      throw new Error("TMDB API key invalid");
    }

    throw new Error(`TMDB API error: ${errorMessage || response.statusText}`);
  }
}
