import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { users, type User } from "../db/schema.js";

export interface UpsertUserParams {
  id: string;
  email: string;
  googleId: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export class UserRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] ?? null;
  }

  async upsert(params: UpsertUserParams): Promise<User> {
    const result = await this.db
      .insert(users)
      .values({
        id: params.id,
        email: params.email,
        googleId: params.googleId,
        name: params.name ?? null,
        avatarUrl: params.avatarUrl ?? null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: params.email,
          googleId: params.googleId,
          name: params.name ?? null,
          avatarUrl: params.avatarUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to upsert user");
    }

    return result[0];
  }
}

export type { User };
