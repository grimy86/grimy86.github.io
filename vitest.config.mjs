import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Runs the Worker's own routes against a real (local, Miniflare-backed) D1
// instance with the actual migrations applied — not hand-rolled DB mocks —
// so these tests catch the same SQL/schema mistakes a mock could hide.
// Scoped to worker/test only; the Next.js app has no test suite of its own
// yet and isn't part of this config.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "worker/migrations"));

  return {
    test: {
      include: ["worker/test/**/*.test.js"],
      setupFiles: ["./worker/test/setup.js"],
    },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./worker/wrangler.toml" },
        miniflare: {
          // Test-only binding, read by setup.js to apply every real
          // migration before each test file runs.
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
  };
});
