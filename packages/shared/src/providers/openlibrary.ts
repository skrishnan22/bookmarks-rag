/**
 * Open Library provider for book metadata enrichment
 */
import { z } from "zod";

// Zod schemas for API response validation
const openLibraryDocSchema = z.object({
  key: z.string(),
  title: z.string(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  isbn: z.array(z.string()).optional(),
  cover_i: z.number().optional(),
  number_of_pages_median: z.number().optional(),
  subject: z.array(z.string()).optional(),
});

const openLibrarySearchResponseSchema = z.object({
  docs: z.array(openLibraryDocSchema),
  num_found: z.number(),
});

const openLibraryErrorResponseSchema = z.object({
  error: z.string().optional(),
});

export interface BookCandidate {
  kind: "book"; // Discriminant for type narrowing
  externalId: string;
  title: string;
  authors: string[];
  year?: number;
  isbn?: string;
  coverUrl?: string;
  pageCount?: number;
  subjects?: string[];
}

export class OpenLibraryProvider {
  private baseUrl = "https://openlibrary.org";

  async searchBooks(query: string, limit: number = 5): Promise<BookCandidate[]> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      fields:
        "key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject",
    });

    const response = await fetch(`${this.baseUrl}/search.json?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorResult = openLibraryErrorResponseSchema.safeParse(errorJson);
      const errorMessage = errorResult.success ? errorResult.data.error : undefined;
      throw new Error(
        `Open Library search error: ${errorMessage || response.statusText}`
      );
    }

    const json = await response.json();
    const data = openLibrarySearchResponseSchema.parse(json);

    return data.docs.map((doc) => {
      const candidate: BookCandidate = {
        kind: "book",
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
