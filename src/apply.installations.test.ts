import { lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyInstallations,
  findRemovedInstallations,
  removeProjectPathSymlinks,
} from "./apply.js";
import type { IdeAgentsConfig, Installation } from "./types.js";

function inst(
  kind: Installation["kind"],
  artifactId: string,
  repoId = "repo",
): Installation {
  return {
    id: `${kind}-${artifactId}`,
    repoId,
    kind,
    artifactId,
    sourcePath: kind === "skill" ? `skills/${artifactId}` : `agents/${artifactId}.md`,
    targetName: artifactId,
    scopes: { global: true, projectPaths: [] },
  };
}

describe("findRemovedInstallations", () => {
  it("treats skill and agent with same artifactId as distinct", () => {
    const previous = [
      inst("skill", "article-architect"),
      inst("agent", "article-architect"),
      inst("agent", "oracle"),
    ];
    const next = [inst("skill", "article-architect"), inst("agent", "oracle")];

    const removed = findRemovedInstallations(previous, next);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.kind).toBe("agent");
    expect(removed[0]?.artifactId).toBe("article-architect");
  });

  it("detects removed skill without removing agent with same id", () => {
    const previous = [
      inst("skill", "article-architect"),
      inst("agent", "article-architect"),
    ];
    const next = [inst("agent", "article-architect")];

    const removed = findRemovedInstallations(previous, next);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.kind).toBe("skill");
  });
});

const REPO_SLUG = "github-com-openai-skills";
const REPO_ID = "openai-skills";

let globalDir: string;
let projectDirA: string;
let projectDirB: string;

beforeEach(async () => {
  globalDir = await mkdtemp(path.join(tmpdir(), "ide-agents-global-"));
  projectDirA = await mkdtemp(path.join(tmpdir(), "ide-agents-project-a-"));
  projectDirB = await mkdtemp(path.join(tmpdir(), "ide-agents-project-b-"));
});

afterEach(async () => {
  await rm(globalDir, { recursive: true, force: true });
  await rm(projectDirA, { recursive: true, force: true });
  await rm(projectDirB, { recursive: true, force: true });
});

function projectInstallation(projectPaths: string[]): Installation {
  return {
    id: "skill-gh-fix-ci",
    repoId: REPO_ID,
    kind: "skill",
    artifactId: "gh-fix-ci",
    sourcePath: path.join("skills", ".curated", "gh-fix-ci"),
    targetName: "gh-fix-ci",
    scopes: { global: false, projectPaths },
  };
}

function makeProjectConfig(installation: Installation): IdeAgentsConfig {
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

function projectTarget(projectRoot: string): string {
  return path.join(projectRoot, ".cursor", "skills", "gh-fix-ci");
}

describe("applyInstallations multi-project", () => {
  it("creates symlinks in multiple project roots", async () => {
    const installation = projectInstallation([projectDirA, projectDirB]);
    const config = makeProjectConfig(installation);

    await applyInstallations(config);

    expect((await lstat(projectTarget(projectDirA))).isSymbolicLink()).toBe(true);
    expect((await lstat(projectTarget(projectDirB))).isSymbolicLink()).toBe(true);
  });

  it("removes symlink only from dropped project path", async () => {
    const installation = projectInstallation([projectDirA, projectDirB]);
    const config = makeProjectConfig(installation);
    await applyInstallations(config);

    await removeProjectPathSymlinks(installation, [projectDirA], config);

    await expect(lstat(projectTarget(projectDirA))).rejects.toThrow();
    expect((await lstat(projectTarget(projectDirB))).isSymbolicLink()).toBe(true);
  });
});
