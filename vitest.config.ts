import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "packages/**/src/**/*.{test,spec}.ts",
      "apps/**/src/**/*.{test,spec}.ts",
    ],
    exclude: ["node_modules/**", "**/node_modules/**", "dist/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "**/*.config.ts", "**/*.d.ts"],
    },
    testTimeout: 10000,
  },
});
