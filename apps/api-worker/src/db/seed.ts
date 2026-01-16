/**
 * Seed script for local development
 * Run with: npx tsx src/db/seed.ts
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "@rag-bookmarks/shared";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("Seeding database...");

  // Insert test user (ignore if exists)
  try {
    await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: "test@example.com",
        googleId: "test-google-id",
        name: "Test User",
      })
      .onConflictDoNothing();

    console.log("Test user created/exists:", TEST_USER_ID);
  } catch (error) {
    console.error("Error creating test user:", error);
  }

  await client.end();
  console.log("Seed complete!");
}

seed().catch(console.error);
