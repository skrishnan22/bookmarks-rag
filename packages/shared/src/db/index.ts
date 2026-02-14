import { sql } from "drizzle-orm";
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

export async function createAuthedDb(
  connectionString: string,
  userId: string
): Promise<DbConnection> {
  const connection = createDb(connectionString);
  await applyRlsContext(connection.db, userId);
  return connection;
}

async function applyRlsContext(db: Database, userId: string): Promise<void> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });

  await db.execute(sql`set role authenticated`);
  await db.execute(
    sql`select set_config('request.jwt.claim.sub', ${userId}, false)`
  );
  await db.execute(
    sql`select set_config('request.jwt.claim.role', 'authenticated', false)`
  );
  await db.execute(
    sql`select set_config('request.jwt.claims', ${claims}, false)`
  );
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export * from "./schema.js";
