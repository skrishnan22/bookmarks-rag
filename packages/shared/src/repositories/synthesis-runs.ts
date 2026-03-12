import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  synthesisRuns,
  type SynthesisRun,
  type SynthesisRunPhase,
  type SynthesisRunResult,
  type SynthesisRunResultV2,
} from "../db/schema.js";

export interface CreateSynthesisRunParams {
  userId: string;
  query: string;
}

export class SynthesisRunRepository {
  constructor(private db: Database) {}

  async create(params: CreateSynthesisRunParams): Promise<SynthesisRun> {
    const result = await this.db
      .insert(synthesisRuns)
      .values({
        userId: params.userId,
        query: params.query,
        status: "queued",
        phase: "queued",
        progress: 0,
      })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to create synthesis run");
    }

    return result[0];
  }

  async findByIdForUser(
    userId: string,
    id: string
  ): Promise<SynthesisRun | null> {
    const result = await this.db
      .select()
      .from(synthesisRuns)
      .where(and(eq(synthesisRuns.userId, userId), eq(synthesisRuns.id, id)))
      .limit(1);

    return result[0] ?? null;
  }

  async listByUser(
    userId: string,
    limit: number = 20
  ): Promise<SynthesisRun[]> {
    return this.db
      .select()
      .from(synthesisRuns)
      .where(eq(synthesisRuns.userId, userId))
      .orderBy(desc(synthesisRuns.createdAt))
      .limit(limit);
  }

  async markStarted(id: string): Promise<SynthesisRun | null> {
    const result = await this.db
      .update(synthesisRuns)
      .set({
        status: "running",
        phase: "retrieval",
        progress: 20,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(synthesisRuns.id, id))
      .returning();

    return result[0] ?? null;
  }

  async updatePhase(
    id: string,
    phase: SynthesisRunPhase,
    progress: number
  ): Promise<SynthesisRun | null> {
    const result = await this.db
      .update(synthesisRuns)
      .set({
        status: "running",
        phase,
        progress,
        updatedAt: new Date(),
      })
      .where(eq(synthesisRuns.id, id))
      .returning();

    return result[0] ?? null;
  }

  async markComplete(
    id: string,
    resultPayload: SynthesisRunResult
  ): Promise<SynthesisRun | null> {
    const result = await this.db
      .update(synthesisRuns)
      .set({
        status: "complete",
        phase: "complete",
        progress: 100,
        result: resultPayload,
        errorCode: null,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(synthesisRuns.id, id))
      .returning();

    return result[0] ?? null;
  }

  async markFailed(
    id: string,
    errorCode: string,
    errorMessage: string,
    phase: SynthesisRunPhase = "failed"
  ): Promise<SynthesisRun | null> {
    const result = await this.db
      .update(synthesisRuns)
      .set({
        status: "failed",
        phase,
        errorCode,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(synthesisRuns.id, id))
      .returning();

    return result[0] ?? null;
  }

  // V2 Methods for component-based rendering

  /**
   * Mark a run as started with V2 (component-based) rendering
   */
  async markStartedV2(id: string): Promise<SynthesisRun | null> {
    const result = await this.db
      .update(synthesisRuns)
      .set({
        status: "running",
        phase: "retrieval",
        progress: 20,
        resultVersion: 2,
        components: [],
        renderIndex: 0,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(synthesisRuns.id, id))
      .returning();

    return result[0] ?? null;
  }

  /**
   * Append components to a V2 synthesis run.
   * Uses jsonb_concat to atomically append to the components array.
   */
  async appendComponents(
    id: string,
    newComponents: Record<string, unknown>[]
  ): Promise<SynthesisRun | null> {
    if (newComponents.length === 0) {
      return this.findById(id);
    }

    const result = await this.db
      .update(synthesisRuns)
      .set({
        components: sql`COALESCE(${synthesisRuns.components}, '[]'::jsonb) || ${JSON.stringify(newComponents)}::jsonb`,
        renderIndex: sql`${synthesisRuns.renderIndex} + ${newComponents.length}`,
        updatedAt: new Date(),
      })
      .where(eq(synthesisRuns.id, id))
      .returning();

    return result[0] ?? null;
  }

  /**
   * Get components starting from a specific index (for SSE streaming)
   */
  async getComponentsFromIndex(
    id: string,
    fromIndex: number
  ): Promise<{ components: Record<string, unknown>[]; totalCount: number } | null> {
    const run = await this.findById(id);
    if (!run) {
      return null;
    }

    const allComponents = (run.components ?? []) as Record<string, unknown>[];
    const components = allComponents.slice(fromIndex);

    return {
      components,
      totalCount: allComponents.length,
    };
  }

  /**
   * Mark a V2 run as complete with the full result
   */
  async markCompleteV2(
    id: string,
    resultPayload: SynthesisRunResultV2
  ): Promise<SynthesisRun | null> {
    const result = await this.db
      .update(synthesisRuns)
      .set({
        status: "complete",
        phase: "complete",
        progress: 100,
        result: resultPayload as unknown as SynthesisRunResult,
        components: resultPayload.components as Record<string, unknown>[],
        renderIndex: resultPayload.components.length,
        resultVersion: 2,
        errorCode: null,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(synthesisRuns.id, id))
      .returning();

    return result[0] ?? null;
  }

  /**
   * Find a run by ID (without user scoping, for internal use)
   */
  async findById(id: string): Promise<SynthesisRun | null> {
    const result = await this.db
      .select()
      .from(synthesisRuns)
      .where(eq(synthesisRuns.id, id))
      .limit(1);

    return result[0] ?? null;
  }
}

export type { SynthesisRun, SynthesisRunPhase, SynthesisRunResult, SynthesisRunResultV2 };
