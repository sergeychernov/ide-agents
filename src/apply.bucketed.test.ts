import { lstat, mkdtemp, readlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyInstallations,
  removeInstallationSymlinks,
} from "./apply.js";
import { getRepoPath } from "./paths.js";
import type { IdeAgentsConfig, Installation } from "./types.js";

const REPO_SLUG = "github-com-openai-skills";
const REPO_ID = "openai-skills";

let globalDir: string;

beforeEach(async () => {
  globalDir = await mkdtemp(path.join(tmpdir(), "ide-agents-apply-"));
});

afterEach(async () => {
  await rm(globalDir, { recursive: true, force: true });
});

function bucketedInstallation(
  overrides: Partial<Installation> = {},
): Installation {
  return {
    id: "skill-gh-fix-ci",
    repoId: REPO_ID,
    kind: "skill",
    artifactId: "gh-fix-ci",
    sourcePath: path.join("skills", ".curated", "gh-fix-ci"),
    targetName: "gh-fix-ci",
    scopes: { global: true, projectPaths: [] },
    ...overrides,
  };
}

function makeConfig(installation: Installation): IdeAgentsConfig {
  return {
    version: 1,
    adapter: "cursor",
    ides: {
      cursor: { enabled: true, configPath: globalDir },
      claude: { enabled: false, configPath: "" },
      codex: { enabled: false, configPath: "" },
      opencode: { enabled: false, configPath: "" },
    },
    server: { port: 3921 },
    repos: [
      {
        id: REPO_ID,
        url: "https://github.com/openai/skills.git",
        ref: "main",
        slug: REPO_SLUG,
      },
    ],
    installations: [installation],
    recentProjects: [],
  };
}

function expectedSource(): string {
  return path.resolve(
    getRepoPath(REPO_SLUG),
    "skills",
    ".curated",
    "gh-fix-ci",
  );
}

function globalTarget(): string {
  return path.join(globalDir, "skills", "gh-fix-ci");
}

describe("applyInstallations with bucketed skill sourcePath", () => {
  it("creates a flat symlink pointing into the bucket directory", async () => {
    const config = makeConfig(bucketedInstallation());

    const { results } = await applyInstallations(config);

    const created = results.find((r) => r.action === "created");
    expect(created?.path).toBe(globalTarget());
    expect(created?.error).toBeUndefined();

    const stats = await lstat(globalTarget());
    expect(stats.isSymbolicLink()).toBe(true);

    const link = await readlink(globalTarget());
    const resolved = path.resolve(path.dirname(globalTarget()), link);
    expect(resolved).toBe(expectedSource());
  });

  it("is idempotent — re-applying skips an existing correct symlink", async () => {
    const config = makeConfig(bucketedInstallation());

    await applyInstallations(config);
    const { results } = await applyInstallations(config);

    expect(results.some((r) => r.action === "created")).toBe(false);
    expect(results.some((r) => r.action === "skipped")).toBe(true);
  });

  it("removes the symlink for a bucketed installation", async () => {
    const installation = bucketedInstallation();
    const config = makeConfig(installation);

    await applyInstallations(config);
    const removed = await removeInstallationSymlinks(installation, config);

    expect(removed.some((r) => r.action === "removed")).toBe(true);
    await expect(lstat(globalTarget())).rejects.toThrow();
  });
});
