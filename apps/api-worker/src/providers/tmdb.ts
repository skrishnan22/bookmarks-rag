/**
 * TMDB provider for movie and TV show metadata enrichment
 *
 * Uses raw fetch calls to keep bundle size small.
 * API docs: https://developers.themoviedb.org/3/
 */

export interface MovieCandidate {
  externalId: string; // tmdb:{id}
  title: string;
  directors?: string[];
  year?: number;
  posterUrl?: string;
  tmdbId: number;
  imdbId?: string;
  runtime?: number;
  genres?: string[];
  popularity: number; // For disambiguation
}

export interface TvShowCandidate {
  externalId: string; // tmdb:{id}
  title: string;
  creators?: string[];
  firstAirYear?: number;
  posterUrl?: string;
  tmdbId: number;
  seasons?: number;
  genres?: string[];
  popularity: number; // For disambiguation
}

interface TMDBSearchResponse<T> {
  results: T[];
  total_results: number;
}

interface TMDBMovieResult {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string;
  popularity: number;
  genre_ids: number[];
}

interface TMDBTvResult {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path?: string;
  popularity: number;
  genre_ids: number[];
}

interface TMDBMovieDetails extends TMDBMovieResult {
  imdb_id?: string;
  runtime?: number;
  genres: Array<{ id: number; name: string }>;
}

interface TMDBTvDetails extends TMDBTvResult {
  number_of_seasons?: number;
  genres: Array<{ id: number; name: string }>;
  created_by: Array<{ name: string }>;
}

interface TMDBMovieCreditsResponse {
  crew: Array<{
    job: string;
    name: string;
  }>;
}

interface TMDBErrorResponse {
  status_message?: string;
}

export class TMDBProvider {
  private baseUrl = "https://api.themoviedb.org/3";
  private imageBaseUrl = "https://image.tmdb.org/t/p/w500";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchMovies(query: string, limit: number = 5): Promise<MovieCandidate[]> {
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

    const data = (await response.json()) as TMDBSearchResponse<TMDBMovieResult>;
    const topResults = data.results.slice(0, limit);

    // Fetch details for each movie to get directors and full metadata
    const candidates = await Promise.all(
      topResults.map((movie) => this.getMovieDetails(movie.id))
    );

    return candidates;
  }

  async searchTvShows(query: string, limit: number = 5): Promise<TvShowCandidate[]> {
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

    const data = (await response.json()) as TMDBSearchResponse<TMDBTvResult>;
    const topResults = data.results.slice(0, limit);

    // Fetch details for each TV show to get creators and full metadata
    const candidates = await Promise.all(
      topResults.map((show) => this.getTvShowDetails(show.id))
    );

    return candidates;
  }

  private async getMovieDetails(movieId: number): Promise<MovieCandidate> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
    });

    // Fetch movie details
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

    const details = (await detailsResponse.json()) as TMDBMovieDetails;

    // Fetch credits to get directors
    const creditsResponse = await fetch(
      `${this.baseUrl}/movie/${movieId}/credits?${params}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    let directors: string[] = [];
    if (creditsResponse.ok) {
      const credits = (await creditsResponse.json()) as TMDBMovieCreditsResponse;
      directors = credits.crew
        .filter((member) => member.job === "Director")
        .map((member) => member.name);
    }

    const candidate: MovieCandidate = {
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

    const details = (await response.json()) as TMDBTvDetails;

    const candidate: TvShowCandidate = {
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
    if (details.number_of_seasons) candidate.seasons = details.number_of_seasons;

    return candidate;
  }

  private async handleError(response: Response): Promise<never> {
    const error = (await response.json().catch(() => ({}))) as TMDBErrorResponse;

    if (response.status === 429) {
      throw new Error("TMDB rate limit exceeded");
    }

    if (response.status === 401) {
      throw new Error("TMDB API key invalid");
    }

    throw new Error(
      `TMDB API error: ${error.status_message || response.statusText}`
    );
  }
}
