/**
 * Open Library provider for book metadata enrichment
 *
 * Uses raw fetch calls to keep bundle size small.
 * API docs: https://openlibrary.org/dev/docs/api/search
 */

export interface BookCandidate {
  externalId: string; // openlibrary work key (e.g., "/works/OL19517427W")
  title: string;
  authors: string[];
  year?: number;
  isbn?: string;
  coverUrl?: string;
  pageCount?: number;
  subjects?: string[];
}

interface OpenLibrarySearchResponse {
  docs: Array<{
    key: string;
    title: string;
    author_name?: string[];
    first_publish_year?: number;
    isbn?: string[];
    cover_i?: number;
    number_of_pages_median?: number;
    subject?: string[];
  }>;
  num_found: number;
}

interface OpenLibraryErrorResponse {
  error?: string;
}

export class OpenLibraryProvider {
  private baseUrl = "https://openlibrary.org";

  async searchBooks(query: string, limit: number = 5): Promise<BookCandidate[]> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      fields: "key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject",
    });

    const response = await fetch(`${this.baseUrl}/search.json?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as OpenLibraryErrorResponse;
      throw new Error(
        `Open Library search error: ${error.error || response.statusText}`
      );
    }

    const data = (await response.json()) as OpenLibrarySearchResponse;

    return data.docs.map((doc) => {
      const candidate: BookCandidate = {
        externalId: `openlibrary:${doc.key}`,
        title: doc.title,
        authors: doc.author_name || [],
      };

      if (doc.first_publish_year) candidate.year = doc.first_publish_year;
      if (doc.isbn?.[0]) candidate.isbn = doc.isbn[0];
      if (doc.cover_i) {
        candidate.coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
      }
      if (doc.number_of_pages_median) candidate.pageCount = doc.number_of_pages_median;
      if (doc.subject) candidate.subjects = doc.subject.slice(0, 5);

      return candidate;
    });
  }
}
