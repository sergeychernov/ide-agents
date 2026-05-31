import { defineConfig } from "vitest/config";
export default defineConfig({
    test: {
        projects: [
            {
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
