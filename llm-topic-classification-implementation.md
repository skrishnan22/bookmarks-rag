# LLM-Based Topic Classification Implementation

## What Changed

Replaced k-means clustering with **LLM-based topic classification**. The LLM now intelligently categorizes bookmarks by understanding semantic meaning, and automatically deduplicates similar topic names.

---

## Architecture

### Before (K-Means)
```
Bookmark Ingestion → Compute Embedding → K-Means Clustering → Force Assignment
                                              ↓
                                    Generic names like "Learn & Skills"
```

### After (LLM Classification)
```
Bookmark Ingestion → Create Metadata → Enqueue Clustering
                                              ↓
                         Clustering Queue → LLM Classification → Smart Topic Assignment
                                              ↓
                                   Domain-specific names like "System Design"
```

---

## How It Works

### 1. Ingestion Flow (Fast)
**File**: `apps/api-worker/src/index.ts:109-287`

When a bookmark is ingested:
1. Extract markdown, generate summary, create chunks
2. Generate embeddings for chunks
3. **Check if clustering should run**:
   - Initial: When user has ≥20 bookmarks and 0 topics
   - Incremental: Every 20 new bookmarks
4. Enqueue clustering message to separate queue

**No topic assignment happens during ingestion** - keeps it fast.

---

### 2. Clustering Queue (LLM Classification)
**File**: `apps/api-worker/src/index.ts:290-319`

When clustering message is received:
1. Call `runLLMClustering()` with user ID and LLM provider
2. Process all bookmarks for that user
3. Log results

---

### 3. LLM Classification Service
**File**: `apps/api-worker/src/services/llm-topic-classification.ts`

For each bookmark:

```typescript
const prompt = `
You are categorizing a bookmark into topics.

EXISTING TOPICS:
- System Design
- Machine Learning
- Product Management

BOOKMARK:
Title: The System Design Primer
URL: https://github.com/donnemartin/system-design-primer
Summary: Learn how to design large-scale systems...

RULES:
1. If this bookmark fits an EXISTING topic, use EXACTLY that name
2. If not, create a NEW topic (1-3 words, domain-specific)
3. NEVER use generic terms like "Learning", "Resources", "Skills"

Topic name:
`;
```

**Output**: `"System Design"` (reuses existing topic)

---

### 4. LLM Orchestration
**File**: `apps/api-worker/src/services/clustering/llm-orchestration.ts`

**Main function**: `runLLMClustering(db, userId, llmProvider)`

Steps:
1. Fetch all bookmarks for user
2. Fetch existing topics (excluding "Uncategorized")
3. For each bookmark:
   - Call LLM with bookmark data + existing topics list
   - If LLM suggests existing topic → reuse it
   - If LLM suggests new topic → create it
   - Assign bookmark to topic (score: 1.0)
4. Refresh topic bookmark counts

**Progressive topic growth**: As the LLM creates new topics, they're added to the list for subsequent classifications, ensuring consistency.

---

## Key Features

### ✅ Automatic Topic Deduplication

The LLM sees all existing topics and reuses them when appropriate:
- "System Design Primer" → sees "System Design" exists → uses it
- "Distributed Systems Guide" → sees "System Design" exists → uses it
- "Product Roadmaps" → nothing fits → creates "Product Management"

### ✅ Domain-Specific Names

The prompt explicitly rejects generic terms:
```typescript
const DISALLOWED_WORDS = [
  "learning", "resources", "articles", "development",
  "skills", "guides", "tutorials"
];
```

### ✅ Smart Validation

- Topic names must be 1-4 words
- Must not contain newlines
- Must not contain disallowed generic words
- Falls back to "Miscellaneous" if invalid

### ✅ Batch Processing

All bookmarks are classified in the clustering queue, not during ingestion:
- Faster ingestion (no LLM call blocking)
- Batch processing is more efficient
- User can trigger manual re-classification

---

## Cost Estimate

**Per Bookmark**:
- ~200 input tokens (prompt + topic list)
- ~10 output tokens (topic name)
- **~$0.0003** with gpt-4o-mini

**For 1000 bookmarks**: ~$0.30 total

---

## Triggers

### Initial Clustering
When user has **≥20 bookmarks** and **0 topics**

### Incremental Updates
Every **20 new bookmarks**

### Weekly Scheduled
Runs for all users (via cron trigger)

### Manual Trigger
`POST /api/v1/topics/recluster`

---

## Example Flow

### User adds bookmark #1-19
- No clustering triggered (below threshold)
- Bookmarks have no topics yet

### User adds bookmark #20
- Clustering triggered (initial)
- LLM classifies all 20 bookmarks
- Creates 3-5 topics (e.g., "System Design", "Machine Learning", "Product Management")

### User adds bookmark #21-39
- No clustering triggered

### User adds bookmark #40
- Clustering triggered (incremental)
- LLM sees existing topics, reuses most
- Maybe creates 1-2 new topics

---

## Testing

To test the implementation:

```bash
# 1. Add a bookmark
POST /api/v1/bookmarks
{
  "url": "https://github.com/donnemartin/system-design-primer"
}

# 2. Wait for ingestion to complete

# 3. Check if bookmark count reached threshold (check logs)

# 4. Clustering queue will automatically process

# 5. Check topics
GET /api/v1/topics

# 6. Manually trigger re-clustering
POST /api/v1/topics/recluster
```

---

## Files Modified

| File | Change |
|------|--------|
| `services/llm-topic-classification.ts` | ✨ NEW: LLM classification logic |
| `services/clustering/llm-orchestration.ts` | ✨ NEW: Orchestrates LLM clustering |
| `index.ts:109-287` | Modified ingestion to remove real-time topic assignment |
| `index.ts:290-319` | Modified clustering handler to use LLM |

---

## Comparison: K-Means vs LLM

| Aspect | K-Means | LLM Classification |
|--------|---------|-------------------|
| **Topic Quality** | Generic ("Learn & Skills") | Domain-specific ("System Design") |
| **Outlier Handling** | Forces everything into clusters | Can handle edge cases naturally |
| **New Data** | Requires re-clustering | Incremental, reuses existing topics |
| **Topic Count** | Fixed k (e.g., 5-30) | Grows organically as needed |
| **Deduplication** | None | LLM understands synonyms |
| **Cost** | $0 | ~$0.0003/bookmark |
| **Speed** | Fast (100ms for 1K items) | Slower (~1-2s per bookmark) |
| **Runs in Workers** | ✅ | ✅ |

---

## Next Steps

1. **Test with real bookmarks**: Add 20+ bookmarks and verify topic quality
2. **Monitor costs**: Check OpenRouter usage for gpt-4o-mini
3. **Tune prompt**: Adjust if topic names aren't specific enough
4. **Add rate limiting**: Consider batching LLM calls with delays if hitting rate limits
5. **UI improvements**: Show topic creation in real-time, allow manual topic merging

---

## Rollback Plan

If you want to revert to k-means:

```typescript
// In index.ts handleClusteringMessage():
const orchestrator = createClusteringOrchestrator(db, llmProvider);
const result = await orchestrator.runFullClustering(userId);
```

The old k-means code is still in `services/clustering/orchestration.ts`.
