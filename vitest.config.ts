import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@shared": path.join(rootDir, "src", "shared"),
          },
        },
        test: {
          name: "web",
          include: ["web/src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "server",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
