import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node environment — this is a Discord bot, no DOM.
    environment: "node",
    // Colocated specs next to the code they cover.
    include: ["src/**/*.spec.ts"],
  },
});
