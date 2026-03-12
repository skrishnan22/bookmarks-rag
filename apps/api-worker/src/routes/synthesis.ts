import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createAuthedDb, SynthesisRunRepository } from "@rag-bookmarks/shared";
import type { AppContext } from "../types.js";

const synthesisBodySchema = z.object({
  query: z.string().min(1).max(500),
  version: z.number().int().min(1).max(2).default(2), // Default to V2
});

const synthesisRunParamSchema = z.object({
  runId: z.string().uuid(),
});

const streamQuerySchema = z.object({
  fromIndex: z.coerce.number().int().min(0).default(0),
});

const DEFAULT_POLL_AFTER_MS = 1500;
const STREAM_POLL_INTERVAL_MS = 500;
const MAX_STREAM_DURATION_MS = 5 * 60 * 1000; // 5 minutes max

const synthesisRouter = new Hono<AppContext>();

/**
 * POST /api/v1/synthesis
 *
 * Create an async synthesis run and start the workflow.
 *
 * Body: { query: string }
 * Response: 202 { success: true, data: { runId, status, phase, progress } }
 */
synthesisRouter.post(
  "/",
  zValidator("json", synthesisBodySchema),
  async (c) => {
    const { query, version } = c.req.valid("json");
    const auth = c.get("auth");
    if (!auth?.userId) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    const { userId } = auth;
    const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
    const runRepo = new SynthesisRunRepository(db);

    try {
      const run = await runRepo.create({ userId, query });

      try {
        await c.env.SYNTHESIS_WORKFLOW.create({
          id: run.id,
          params: {
            runId: run.id,
            userId,
            query,
            version, // Pass version to workflow
          },
        });
      } catch (workflowError) {
        const workflowErrorMessage =
          workflowError instanceof Error
            ? workflowError.message
            : "Failed to start synthesis workflow";

        await runRepo.markFailed(
          run.id,
          "WORKFLOW_START_FAILED",
          workflowErrorMessage,
          "failed"
        );

        throw workflowError;
      }

      return c.json(
        {
          success: true,
          data: {
            runId: run.id,
            status: run.status,
            phase: run.phase,
            progress: run.progress,
            version,
            pollAfterMs: DEFAULT_POLL_AFTER_MS,
            streamUrl: version === 2 ? `/api/v1/synthesis/${run.id}/stream` : undefined,
            createdAt: run.createdAt?.toISOString() ?? new Date().toISOString(),
          },
        },
        202
      );
    } catch (error) {
      console.error("Error creating synthesis run:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create synthesis run",
          },
        },
        500
      );
    }
  }
);

/**
 * GET /api/v1/synthesis/:runId
 *
 * Poll status and retrieve run result when complete.
 */
synthesisRouter.get(
  "/:runId",
  zValidator("param", synthesisRunParamSchema),
  async (c) => {
    const { runId } = c.req.valid("param");
    const auth = c.get("auth");
    if (!auth?.userId) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    const { userId } = auth;
    const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
    const runRepo = new SynthesisRunRepository(db);

    try {
      const run = await runRepo.findByIdForUser(userId, runId);

      if (!run) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Synthesis run not found",
            },
          },
          404
        );
      }

      const payload: {
        runId: string;
        query: string;
        status: string;
        phase: string;
        progress: number;
        version: number;
        createdAt: string | null;
        startedAt: string | null;
        updatedAt: string | null;
        completedAt?: string | null;
        pollAfterMs?: number;
        streamUrl?: string;
        error?: { code: string; message: string };
        result?: Record<string, unknown>;
        components?: Record<string, unknown>[];
        renderIndex?: number;
      } = {
        runId: run.id,
        query: run.query,
        status: run.status,
        phase: run.phase,
        progress: run.progress,
        version: run.resultVersion,
        createdAt: run.createdAt?.toISOString() ?? null,
        startedAt: run.startedAt?.toISOString() ?? null,
        updatedAt: run.updatedAt?.toISOString() ?? null,
      };

      if (run.status === "complete") {
        payload.completedAt = run.completedAt?.toISOString() ?? null;
        if (run.result) {
          payload.result = run.result as unknown as Record<string, unknown>;
        }
        // V2: include components
        if (run.resultVersion === 2 && run.components) {
          payload.components = run.components as Record<string, unknown>[];
          payload.renderIndex = run.renderIndex;
        }
      }

      if (run.status === "failed") {
        payload.error = {
          code: run.errorCode ?? "SYNTHESIS_FAILED",
          message: run.errorMessage ?? "Synthesis run failed",
        };
      }

      if (run.status === "queued" || run.status === "running") {
        payload.pollAfterMs = DEFAULT_POLL_AFTER_MS;
        // V2: include stream URL and current components
        if (run.resultVersion === 2) {
          payload.streamUrl = `/api/v1/synthesis/${run.id}/stream`;
          payload.components = (run.components ?? []) as Record<string, unknown>[];
          payload.renderIndex = run.renderIndex;
        }
      }

      return c.json({ success: true, data: payload });
    } catch (error) {
      console.error("Error fetching synthesis run:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch synthesis run",
          },
        },
        500
      );
    }
  }
);

/**
 * GET /api/v1/synthesis/:runId/stream
 *
 * SSE endpoint that streams components as they are generated (V2 only).
 * Client should reconnect with ?fromIndex=N to resume.
 *
 * Events:
 * - component: { index: number, component: ComponentSpec }
 * - progress: { phase: string, progress: number }
 * - complete: { totalComponents: number }
 * - error: { code: string, message: string }
 */
synthesisRouter.get(
  "/:runId/stream",
  zValidator("param", synthesisRunParamSchema),
  zValidator("query", streamQuerySchema),
  async (c) => {
    const { runId } = c.req.valid("param");
    const { fromIndex } = c.req.valid("query");
    const auth = c.get("auth");

    if (!auth?.userId) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    const { userId } = auth;

    // Verify the run belongs to this user
    const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
    const runRepo = new SynthesisRunRepository(db);
    const run = await runRepo.findByIdForUser(userId, runId);

    if (!run) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Synthesis run not found",
          },
        },
        404
      );
    }

    // If V1 run, return error
    if (run.resultVersion !== 2) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_V2",
            message: "This run uses V1 rendering. Use polling endpoint instead.",
          },
        },
        400
      );
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let currentIndex = fromIndex;
        let lastPhase = run.phase;
        let lastProgress = run.progress;
        const startTime = Date.now();

        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        const poll = async (): Promise<boolean> => {
          // Check timeout
          if (Date.now() - startTime > MAX_STREAM_DURATION_MS) {
            sendEvent("timeout", { message: "Stream timeout, please reconnect" });
            return false;
          }

          try {
            const { db: pollDb } = await createAuthedDb(c.env.DATABASE_URL, userId);
            const pollRepo = new SynthesisRunRepository(pollDb);
            const currentRun = await pollRepo.findByIdForUser(userId, runId);

            if (!currentRun) {
              sendEvent("error", { code: "NOT_FOUND", message: "Run not found" });
              return false;
            }

            // Send progress updates if phase changed
            if (currentRun.phase !== lastPhase || currentRun.progress !== lastProgress) {
              sendEvent("progress", {
                phase: currentRun.phase,
                progress: currentRun.progress,
              });
              lastPhase = currentRun.phase;
              lastProgress = currentRun.progress;
            }

            // Send new components
            const componentsData = await pollRepo.getComponentsFromIndex(runId, currentIndex);
            if (componentsData && componentsData.components.length > 0) {
              for (const component of componentsData.components) {
                sendEvent("component", {
                  index: currentIndex,
                  component,
                });
                currentIndex++;
              }
            }

            // Check if complete
            if (currentRun.status === "complete") {
              sendEvent("complete", {
                totalComponents: currentRun.renderIndex,
              });
              return false;
            }

            // Check if failed
            if (currentRun.status === "failed") {
              sendEvent("error", {
                code: currentRun.errorCode ?? "SYNTHESIS_FAILED",
                message: currentRun.errorMessage ?? "Synthesis failed",
              });
              return false;
            }

            return true;
          } catch (error) {
            console.error("SSE poll error:", error);
            sendEvent("error", {
              code: "POLL_ERROR",
              message: "Error polling for updates",
            });
            return false;
          }
        };

        // Initial poll
        let shouldContinue = await poll();

        // Continue polling
        while (shouldContinue) {
          await new Promise((resolve) => setTimeout(resolve, STREAM_POLL_INTERVAL_MS));
          shouldContinue = await poll();
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
);

export { synthesisRouter };
