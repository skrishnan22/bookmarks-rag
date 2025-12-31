# Personal RAG on Bookmarks - Architecture & Decisions

## Product Vision

- **Not a bookmark manager** → Personal recall engine
- **Core problem**: Bookmarks are graveyards
- **Core promise**: Saved knowledge resurfaces when it matters
- **Differentiation**: Timing + context, not storage or search

## Core Features

1. **Parallel recall via browser search**
   - Side panel surfaces past saved knowledge during normal searches
   - Explicit, event-driven, non-invasive

2. **Topic clustering (no graph UI)**
   - Stable, incremental topic memory
   - One bookmark → multiple topics (soft membership)
   - Topics evolve slowly over time (centroid drift)

3. **Action-based system lists**
   - Books, Movies, Tools, Places
   - Auto-generated, user-editable
   - Power resurfacing + reminders

## What We Rejected

- Folder-heavy UX
- Manual tagging as primary flow
- Graph RAG as the backbone
- LLMs making irreversible structural decisions
- Continuous browsing surveillance

---

## Architecture Overview

```
[Cloudflare Workers]
├── UI Worker (public)           # Static HTML/JS frontend
├── API Worker (public)          # REST API with auth, calls Markdowner via service binding
└── Markdowner Worker (private)  # URL→markdown conversion, internal only
                                    ↓
[Supabase - PostgreSQL + pgvector]
├── users                        # User accounts
├── bookmarks                    # Metadata + summary (parent)
├── chunks                       # Vectorized content with context (child)
├── topics                       # Clustered entities
└── bookmark_topics              # Soft membership (many-to-many)
```

---

## Tech Stack

### Backend: Node.js + Hono

| Aspect           | Decision                                                                          |
| ---------------- | --------------------------------------------------------------------------------- |
| **Runtime**      | Node.js (Cloudflare Workers compatibility mode)                                   |
| **Framework**    | Hono (lightweight, fast, Cloudflare-native)                                       |
| **Why**          | First-class Cloudflare Workers support, excellent DX, minimal overhead            |
| **Alternatives** | Bun (rejected - known Workers compatibility issues), Express (rejected - heavier) |

### Database: Supabase

| Aspect                 | Decision                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **Provider**           | Supabase (PostgreSQL + pgvector)                                                     |
| **Why**                | Built-in connection pooler (Supavisor), generous free tier (500MB), pgvector support |
| **Free tier capacity** | ~5,000-7,000 bookmarks before hitting 500MB limit                                    |
| **Paid tier**          | $25/mo when needed                                                                   |
| **Alternatives**       | Railway + Hyperdrive (rejected - more setup), Neon (viable alternative)              |

### Authentication

| Aspect            | Decision                                                     |
| ----------------- | ------------------------------------------------------------ |
| **Provider**      | Google OAuth 2.0                                             |
| **Token storage** | JWT in HTTP-only cookie with CSRF protection                 |
| **User table**    | Minimal (id, email, google_id, name, avatar_url, created_at) |
| **Library**       | Raw OAuth flow (no heavy auth libraries)                     |

---

## RAG Pipeline

### Model Providers

All models accessed via **OpenRouter** for unified API + cost efficiency:

| Component              | Model                  | Provider   | Cost                          |
| ---------------------- | ---------------------- | ---------- | ----------------------------- |
| **Context generation** | gpt-oss-20b            | OpenRouter | $0.03/M input, $0.14/M output |
| **Summary generation** | gpt-oss-20b            | OpenRouter | Same as above                 |
| **Embeddings**         | text-embedding-3-small | OpenRouter | $0.02/M tokens                |
| **Reranking**          | rerank-v3.5            | Cohere     | Free tier (1000/mo)           |

**Total vendors**: 4 (Cloudflare, Supabase, OpenRouter, Cohere)

### Cost Estimate (500 bookmarks)

| Task                                     | Tokens | Cost       |
| ---------------------------------------- | ------ | ---------- |
| Context generation (~6.5M in, ~187K out) | ~6.7M  | ~$0.22     |
| Summary generation (~1M in, ~50K out)    | ~1.05M | ~$0.04     |
| Embeddings (~3M tokens)                  | ~3M    | ~$0.06     |
| **Total one-time ingestion**             |        | **~$0.32** |

### Ingestion Pipeline

```
POST /api/bookmarks
  ↓
1. Validate URL
2. Call Markdowner Worker (service binding)
3. Receive markdown + extract breadcrumb structure
4. Generate summary (gpt-oss-20b) - 1 call per document
5. Chunk content (500 tokens, 25% overlap, semantic boundaries)
6. Generate context per chunk (gpt-oss-20b) - 1 call per chunk
7. Embed contextualized chunks (text-embedding-3-small)
8. Store bookmark + chunks in Supabase
9. Return bookmark ID

Total time: ~10-20 seconds per bookmark
```

### Contextual Retrieval

Based on [Anthropic's research](https://www.anthropic.com/news/contextual-retrieval), contextual retrieval reduces retrieval failures by 49-67%.

**How it works**: Each chunk gets LLM-generated context prepended before embedding:

```
Original chunk:
"The company's revenue grew by 3% over the previous quarter."

Contextualized chunk:
"This chunk is from a TechCrunch article about Stripe's Q2 2024 earnings.
The company's revenue grew by 3% over the previous quarter."
```

**Context generation prompt**:

```
<document>
{{FULL_DOCUMENT_MARKDOWN}}
</document>

<chunk>
{{CHUNK_CONTENT}}
</chunk>

Write 1-2 sentences of context to situate this chunk within the document.
Be specific about what entity, topic, or claim this chunk discusses.
Answer only with the succinct context and nothing else.
```

### Retrieval Pipeline

```
User Query
    │
    ▼
┌─────────────────────────────────┐
│  Embed query (text-embedding-3) │  ~100ms
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Parallel retrieval:            │  ~100ms
│  - pgvector cosine (top 20)     │
│  - BM25 full-text (top 20)      │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  RRF fusion → top 20 combined   │  ~10ms
│  (k=60 for rank fusion)         │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Rerank (Cohere) → top 5        │  ~150ms
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Return chunks + metadata       │
│  (or "No results" if below      │
│   0.3 similarity threshold)     │
└─────────────────────────────────┘

Total: ~400-500ms (within target)
```

### Retrieval Parameters

| Parameter                | Value                   | Notes                       |
| ------------------------ | ----------------------- | --------------------------- |
| **Top-K retrieval**      | 20                      | Before reranking            |
| **Top-N after rerank**   | 5                       | Sent to context             |
| **Similarity threshold** | 0.3                     | Below this = "not relevant" |
| **RRF k value**          | 60                      | Standard default            |
| **BM25 weight**          | Equal (1:1 with vector) | Can tune later              |

### What We Deferred to V2

| Feature                              | Reason                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| **Query expansion**                  | Contextual retrieval + reranking should be sufficient for MVP |
| **Late chunking**                    | More complex, contextual retrieval achieves similar benefits  |
| **Summary embeddings**               | Text-only summary for BM25 + UI is sufficient                 |
| **Hierarchical two-stage retrieval** | Flat chunk search is fast enough for <5K bookmarks            |

---

## Database Schema

### Tables Overview

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │       │  bookmarks  │       │   chunks    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ user_id(FK) │       │ id (PK)     │
│ email       │       │ id (PK)     │◄──────│ bookmark_id │
│ google_id   │       │ url         │       │ content     │
│ name        │       │ title       │       │ context     │
│ avatar_url  │       │ summary     │       │ embedding   │
│ created_at  │       │ markdown    │       │ position    │
│ updated_at  │       │ status      │       │ created_at  │
└─────────────┘       │ created_at  │       └─────────────┘
                      │ updated_at  │
                      └─────────────┘
                             │
                             │
                      ┌──────┴──────┐
                      │             │
               ┌──────▼─────┐ ┌─────▼──────┐
               │ bookmark_  │ │   topics   │
               │ topics     │ │            │
               ├────────────┤ ├────────────┤
               │ bookmark_id│ │ id (PK)    │
               │ topic_id   │ │ user_id    │
               │ score      │ │ name       │
               └────────────┘ │ created_at │
                              └────────────┘
```

### SQL Schema

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  google_id TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookmarks (parent)
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  summary TEXT,                    -- LLM-generated, for UI + BM25
  markdown TEXT,                   -- Full extracted content
  status TEXT DEFAULT 'pending',   -- pending, processing, ready, failed
  error_message TEXT,              -- If ingestion failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, url)             -- No duplicate URLs per user
);

-- Full-text search index on bookmarks
CREATE INDEX idx_bookmarks_fts ON bookmarks
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '')));

-- User lookup index
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);

-- Chunks (child)
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,                    -- Original chunk text
  context TEXT,                             -- LLM-generated context
  contextualized_content TEXT,              -- context + content (for BM25)
  breadcrumb_path TEXT,                     -- "Article > Section > Subsection"
  position INTEGER NOT NULL,                -- Order within document
  token_count INTEGER,                      -- For debugging/stats
  embedding vector(1536),                   -- pgvector (text-embedding-3-small dimensions)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity index (ivfflat for <100K vectors)
CREATE INDEX idx_chunks_embedding ON chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search on contextualized content
CREATE INDEX idx_chunks_fts ON chunks
  USING GIN (to_tsvector('english', contextualized_content));

-- Bookmark lookup index
CREATE INDEX idx_chunks_bookmark_id ON chunks(bookmark_id);

-- Topics (user-specific)
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- Bookmark-Topic relationship (soft membership)
CREATE TABLE bookmark_topics (
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  score FLOAT DEFAULT 1.0,         -- Membership strength (0-1)
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (bookmark_id, topic_id)
);
```

### Hybrid Search Query (RRF Fusion)

```sql
-- Hybrid search: vector + BM25 with Reciprocal Rank Fusion
-- Parameters: $1 = query embedding, $2 = user_id, $3 = query text

WITH vector_results AS (
  SELECT
    c.id,
    c.bookmark_id,
    c.content,
    c.context,
    c.breadcrumb_path,
    1 - (c.embedding <=> $1::vector) as vector_score,
    ROW_NUMBER() OVER (ORDER BY c.embedding <=> $1::vector) as vector_rank
  FROM chunks c
  JOIN bookmarks b ON c.bookmark_id = b.id
  WHERE b.user_id = $2
  ORDER BY c.embedding <=> $1::vector
  LIMIT 20
),
bm25_results AS (
  SELECT
    c.id,
    c.bookmark_id,
    c.content,
    c.context,
    c.breadcrumb_path,
    ts_rank(to_tsvector('english', c.contextualized_content), plainto_tsquery('english', $3)) as bm25_score,
    ROW_NUMBER() OVER (
      ORDER BY ts_rank(to_tsvector('english', c.contextualized_content), plainto_tsquery('english', $3)) DESC
    ) as bm25_rank
  FROM chunks c
  JOIN bookmarks b ON c.bookmark_id = b.id
  WHERE b.user_id = $2
    AND to_tsvector('english', c.contextualized_content) @@ plainto_tsquery('english', $3)
  LIMIT 20
),
combined AS (
  SELECT
    COALESCE(v.id, b.id) as id,
    COALESCE(v.bookmark_id, b.bookmark_id) as bookmark_id,
    COALESCE(v.content, b.content) as content,
    COALESCE(v.context, b.context) as context,
    COALESCE(v.breadcrumb_path, b.breadcrumb_path) as breadcrumb_path,
    -- RRF formula: 1/(k + rank), k=60
    COALESCE(1.0 / (60 + v.vector_rank), 0) +
    COALESCE(1.0 / (60 + b.bm25_rank), 0) as rrf_score
  FROM vector_results v
  FULL OUTER JOIN bm25_results b ON v.id = b.id
)
SELECT * FROM combined
ORDER BY rrf_score DESC
LIMIT 20;
```

---

## Chunking Strategy

| Parameter              | Value                                  | Notes                                               |
| ---------------------- | -------------------------------------- | --------------------------------------------------- |
| **Chunk size**         | 500 tokens                             | Start here, eval other sizes                        |
| **Overlap**            | 25% (~125 tokens)                      | Prevents context loss at boundaries                 |
| **Split strategy**     | Semantic boundaries                    | Markdown headers (`##`), paragraphs, then sentences |
| **Breadcrumbs**        | Store path                             | `"Article Title > Section > Subsection"`            |
| **Metadata per chunk** | position, token_count, breadcrumb_path | For debugging + UI                                  |

---

## Component Decisions

### 1. Content Extraction: Markdowner

| Aspect           | Decision                                                          |
| ---------------- | ----------------------------------------------------------------- |
| **Tool**         | Markdowner (self-hosted on Cloudflare Workers)                    |
| **Why**          | Purpose-built for URL→markdown, simpler than Firecrawl            |
| **Privacy**      | Service binding - no public URL, internal only                    |
| **Alternatives** | Firecrawl (rejected - overkill), Jina AI (rejected - proprietary) |

### 2. Vector Database: pgvector + Supabase

| Aspect         | Decision                                                              |
| -------------- | --------------------------------------------------------------------- |
| **Tool**       | pgvector extension on PostgreSQL                                      |
| **Host**       | Supabase                                                              |
| **Why**        | Single DB for metadata + vectors, built-in pooler, generous free tier |
| **Index type** | ivfflat (good for <100K vectors, easy to switch to HNSW later)        |

### 3. RAG Implementation: Hand-Rolled

| Aspect        | Decision                                                      |
| ------------- | ------------------------------------------------------------- |
| **Framework** | None - custom implementation                                  |
| **Why**       | Simple use case doesn't need LangChain/LlamaIndex abstraction |
| **Control**   | Full control over chunking, retrieval, and prompting          |

### 4. Provider Abstraction (for Open Source)

All model providers should be swappable via config:

```typescript
// config.ts - all models configurable
export const config = {
  embedding: {
    provider: "openrouter", // or 'openai', 'voyage', 'local'
    model: "openai/text-embedding-3-small",
  },
  llm: {
    provider: "openrouter", // or 'openai', 'anthropic', 'ollama'
    model: "openai/gpt-oss-20b",
  },
  reranker: {
    provider: "cohere", // or 'none', 'voyage'
    model: "rerank-v3.5",
    enabled: true,
  },
};
```

---

## Authentication

### Auth Flow

1. User clicks "Sign in with Google"
2. Redirect to Google OAuth
3. Google redirects back with code
4. Exchange code for tokens, get user info
5. Create/find user in Supabase
6. Set HTTP-only cookie with JWT
7. All future requests include cookie automatically

### Why JWT in HTTP-only Cookie

| Benefit               | Explanation                            |
| --------------------- | -------------------------------------- |
| **XSS protection**    | Cookie can't be accessed by JavaScript |
| **Browser automatic** | No manual token handling needed        |
| **CSRF protection**   | Add CSRF token header for mutations    |
| **Simple**            | No complex session storage required    |

---

## Hosting & Infrastructure

### Cloudflare Workers

| Worker            | Exposure                       | Purpose                                        |
| ----------------- | ------------------------------ | ---------------------------------------------- |
| UI Worker         | Public                         | Frontend UI                                    |
| API Worker        | Public                         | Main API, calls Markdowner via service binding |
| Markdowner Worker | Private (service binding only) | URL→markdown conversion                        |

### Supabase

| Aspect                 | Detail                                 |
| ---------------------- | -------------------------------------- |
| **Free tier**          | 500MB storage (~5-7K bookmarks)        |
| **Connection pooling** | Supavisor (built-in, transaction mode) |
| **pgvector**           | Supported out of the box               |
| **Paid tier**          | $25/mo when needed                     |

### Storage Estimate

| Bookmarks | Estimated Storage         |
| --------- | ------------------------- |
| 500       | ~50 MB                    |
| 2,000     | ~150 MB                   |
| 5,000     | ~350 MB                   |
| 7,000     | ~500 MB (free tier limit) |

---

## Evaluation Plan

### Dataset

| Category               | Count | Purpose                                    |
| ---------------------- | ----- | ------------------------------------------ |
| **Golden set**         | 50    | Manually verified QAs, ground truth        |
| **Synthetic eval set** | 150   | LLM-generated questions, automated scoring |
| **Total**              | 200   | Random sample from existing bookmarks      |

### Metrics

| Category       | Metric                     | Focus                                     |
| -------------- | -------------------------- | ----------------------------------------- |
| **Retrieval**  | Hit Rate                   | % queries with at least 1 relevant result |
|                | MRR (Mean Reciprocal Rank) | How high relevant results rank            |
|                | Recall@K                   | % relevant docs in top K results          |
|                | Precision@K                | % of top K results that are relevant      |
| **Generation** | Faithfulness               | Does answer use retrieved context?        |
|                | Answer Relevance           | Does answer address the question?         |
|                | Hallucination Rate         | Made-up info in answers                   |
| **Overall**    | LLM-as-Judge               | 1-10 quality score                        |

### Experiments to Run

1. **Chunking Strategies**
   - Variables: chunk size (500/800/1200), overlap (0/25/50%)
   - Hypothesis: 500 tokens + 25% overlap = best needle recall

2. **Embedding Models**
   - Models: text-embedding-3-small, text-embedding-3-large, Voyage-3
   - Hypothesis: 3-small is sufficient for bookmarks

3. **Retrieval K Values**
   - Values: top 3, 5, 10, 20 results
   - Hypothesis: 20 retrieval → 5 after rerank is optimal

4. **With/Without Contextual Retrieval**
   - Compare retrieval quality with and without LLM-generated context
   - Hypothesis: Contextual retrieval improves recall by 30%+

---

## Security Considerations

| Area                     | Approach                                                   |
| ------------------------ | ---------------------------------------------------------- |
| **API keys**             | Stored in Cloudflare secrets, never exposed to client      |
| **Rate limiting**        | Per-user rate limits on ingestion (prevent API cost abuse) |
| **User data isolation**  | All queries scoped by user_id, enforced at DB level        |
| **CSRF protection**      | Token-based for all mutations                              |
| **Content sanitization** | Markdown sanitized before display (XSS prevention)         |
| **SQL injection**        | Parameterized queries only                                 |

---

## Open Source Considerations

| Goal                    | Approach                                  |
| ----------------------- | ----------------------------------------- |
| **Easy to deploy**      | One-click deploy to Cloudflare + Supabase |
| **Easy to self-host**   | Docker Compose for full stack (future)    |
| **Swappable providers** | Config-based model/provider selection     |
| **Privacy-first**       | All data stays with user by default       |
| **Extensible**          | Clean API for future integrations         |

---

## Next Steps

1. Set up Cloudflare Workers (UI, API, Markdowner) with Hono
2. Deploy PostgreSQL + pgvector on Supabase
3. Implement Google OAuth authentication
4. Build bookmark ingestion pipeline:
   - URL → Markdowner → chunk → contextualize → embed → store
5. Implement hybrid retrieval (BM25 + vector + RRF fusion)
6. Integrate Cohere reranking
7. Build eval pipeline with 200 bookmark sample
8. Run experiments: chunking, embeddings, contextual retrieval impact
9. Iterate based on eval results
10. Build UI with parallel recall side panel
11. Add topic clustering
12. Launch

---

## Outstanding Decisions (To Discuss Later)

| Topic                               | Status                                           |
| ----------------------------------- | ------------------------------------------------ |
| **Chunking boundaries**             | Need to finalize markdown header detection logic |
| **Topic clustering algorithm**      | K-means vs HDBSCAN vs LLM-based categorization   |
| **Clustering schedule**             | Per-bookmark vs batch nightly vs manual trigger  |
| **Browser extension scope**         | MVP features for side panel                      |
| **Fallback for failed extractions** | What to do when Markdowner fails                 |

---

## Appendix: Key References

- [Anthropic Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) - 49-67% retrieval improvement
- [OpenAI gpt-oss Models](https://openai.com/open-models/) - Open-weight reasoning models
- [Markdowner (GitHub)](https://github.com/supermemoryai/markdowner)
- [pgvector](https://github.com/pgvector/pgvector)
- [RAGAS Evaluation](https://github.com/explodinggradients/ragas)
- [Cloudflare Workers Service Binding](https://developers.cloudflare.com/workers-vpc/)
- [Hono Framework](https://hono.dev/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Supabase](https://supabase.com/)
- [Cohere Rerank](https://cohere.com/rerank)
- [OpenRouter](https://openrouter.ai/)
