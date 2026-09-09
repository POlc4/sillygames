import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      include: ["app/**", "components/**", "lib/**"],
      // Les scènes WebGL ne se rendent pas dans jsdom : couvertes par les tests bout en bout.
      exclude: ["components/three/**", "app/layout.tsx", "**/*.test.{ts,tsx}"],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 60 },
      reporter: ["text", "lcov"],
    },
  },
});
