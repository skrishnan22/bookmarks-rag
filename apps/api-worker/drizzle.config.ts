import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Schema location
  schema: "../../packages/shared/src/db/schema.ts",

  // Output directory for migrations (when using generate)
  out: "./drizzle",

  // Database dialect
  dialect: "postgresql",

  // Connection config - uses DATABASE_URL from environment
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },

  // Verbose logging
  verbose: true,

  // Strict mode - warns about potentially destructive changes
  strict: true,
});
