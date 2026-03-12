import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import {
  createAuthedDb,
  SynthesisRunRepository,
  type SynthesisRunPhase,
  type SynthesisRunResult,
  type SynthesisRunResultV2,
} from "@rag-bookmarks/shared";
import type { Env } from "../types.js";
import {
  buildSynthesisArtifacts,
  buildSynthesisArtifactsV2,
} from "../services/synthesis.js";

const PHASE_PROGRESS: Record<SynthesisRunPhase, number> = {
  queued: 0,
  retrieval: 20,
  map: 45,
  reduce: 75,
  excalidraw: 90,
  render: 85,
  visuals: 95,
  complete: 100,
  failed: 100,
};

export interface SynthesisWorkflowParams {
  runId: string;
  userId: string;
  query: string;
  version?: number;
}

export class SynthesisWorkflow extends WorkflowEntrypoint<
  Env,
  SynthesisWorkflowParams
> {
  override async run(
    event: WorkflowEvent<SynthesisWorkflowParams>,
    step: WorkflowStep
  ) {
    const { runId, userId, query, version = 2 } = event.payload;

    // Use V2 path for version 2
    if (version === 2) {
      return this.runV2(runId, userId, query, step);
    }

    // V1 path (legacy)
    await step.do("mark run started", async () => {
      const { db } = await createAuthedDb(this.env.DATABASE_URL, userId);
      const runRepo = new SynthesisRunRepository(db);
      await runRepo.markStarted(runId);
      return { runId };
    });

    try {
      await step.do("generate and persist synthesis artifacts", async () => {
        const { db } = await createAuthedDb(this.env.DATABASE_URL, userId);
        const runRepo = new SynthesisRunRepository(db);

        const artifacts = await buildSynthesisArtifacts({
          query,
          userId,
          db,
          jinaApiKey: this.env.JINA_API_KEY,
          openRouterApiKey: this.env.OPENROUTER_API_KEY,
          onPhaseChange: async (phase) => {
            await runRepo.updatePhase(runId, phase, PHASE_PROGRESS[phase]);
          },
        });

        const result: SynthesisRunResult = {
          synthesis: artifacts.synthesis as unknown as Record<string, unknown>,
          excalidraw: artifacts.excalidraw as unknown as Record<
            string,
            unknown
          >,
        };

        await runRepo.markComplete(runId, result);
        return { runId };
      });

      return { runId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown synthesis error";

      await step.do("mark run failed", async () => {
        const { db } = await createAuthedDb(this.env.DATABASE_URL, userId);
        const runRepo = new SynthesisRunRepository(db);
        await runRepo.markFailed(runId, "SYNTHESIS_FAILED", message, "failed");
        return { runId };
      });

      throw error;
    }
  }

  /**
   * V2 workflow with component-based rendering
   */
  private async runV2(
    runId: string,
    userId: string,
    query: string,
    step: WorkflowStep
  ) {
    await step.do("mark run started v2", async () => {
      const { db } = await createAuthedDb(this.env.DATABASE_URL, userId);
      const runRepo = new SynthesisRunRepository(db);
      await runRepo.markStartedV2(runId);
      return { runId };
    });

    try {
      await step.do("generate v2 synthesis with components", async () => {
        const { db } = await createAuthedDb(this.env.DATABASE_URL, userId);
        const runRepo = new SynthesisRunRepository(db);

        const result = await buildSynthesisArtifactsV2({
          query,
          userId,
          db,
          jinaApiKey: this.env.JINA_API_KEY,
          openRouterApiKey: this.env.OPENROUTER_API_KEY,
          onPhaseChange: async (phase) => {
            await runRepo.updatePhase(runId, phase, PHASE_PROGRESS[phase]);
          },
          onComponents: async (components) => {
            await runRepo.appendComponents(
              runId,
              components as unknown as Record<string, unknown>[]
            );
          },
        });

        await runRepo.markCompleteV2(runId, result);
        return { runId };
      });

      return { runId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown synthesis error";

      await step.do("mark run failed", async () => {
        const { db } = await createAuthedDb(this.env.DATABASE_URL, userId);
        const runRepo = new SynthesisRunRepository(db);
        await runRepo.markFailed(runId, "SYNTHESIS_FAILED", message, "failed");
        return { runId };
      });

      throw error;
    }
  }
}
