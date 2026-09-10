import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` resolves to a module that throws outside a server bundle.
  // Node is a server, so point it at its own no-op entrypoint.
  "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
};

/**
 * Two suites, kept apart because they have different costs.
 *
 * `unit` needs nothing and runs in under a second — it is what you run while
 * writing code. `integration` needs a real Postgres, because the things worth
 * testing here are unique constraints and adapter behaviour, and a mocked
 * Prisma proves nothing about either.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["src/**/*.db.test.ts"],
          setupFiles: ["src/test/unit-setup.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.db.test.ts"],
          globalSetup: ["src/test/db-global-setup.ts"],
          setupFiles: ["src/test/db-setup.ts"],
          // Each file truncates shared tables, so they cannot run concurrently.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
