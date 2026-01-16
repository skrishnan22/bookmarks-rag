import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export interface DbConnection {
  db: Database;
  close: () => Promise<void>;
}

export function createDb(connectionString: string): DbConnection {
  const client = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export * from "./schema.js";
