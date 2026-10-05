import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // sem .env: usa as variáveis do ambiente
}

export default defineConfig({
  test: { include: ["test/live/**/*.live.test.ts"], testTimeout: 120_000 },
});
