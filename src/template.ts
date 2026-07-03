import { cp, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commitAndPushRepo } from "./git.js";
import { scanRepo, scanRepoArtifacts } from "./scan.js";
import type { SkillLayout } from "./types.js";

const GITHUB_INIT_FILES = new Set([
  "README.md",
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  ".gitignore",
]);

export interface BootstrapResult {
  applied: boolean;
  pushed: boolean;
  pushError?: string;
  skillCount: number;
  agentCount: number;
  skillLayout: SkillLayout;
}

export function getTemplateDir(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "../template");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/** True when the clone has no installable artifacts and no custom content. */
export async function isEmptySkillRepo(repoPath: string): Promise<boolean> {
  const artifacts = await scanRepoArtifacts(repoPath);
  if (artifacts.length > 0) {
    return false;
  }

  const entries = await readdir(repoPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") {
      continue;
    }
    if (entry.isDirectory()) {
      return false;
    }
    if (!GITHUB_INIT_FILES.has(entry.name)) {
      return false;
    }
  }

  return true;
}

export async function applyTemplateToRepo(repoPath: string): Promise<void> {
  const templateDir = getTemplateDir();
  if (!(await pathExists(templateDir))) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }

  const entries = await readdir(templateDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(templateDir, entry.name);
    const dest = path.join(repoPath, entry.name);
    await cp(src, dest, { recursive: true, force: true });
  }
}

export async function bootstrapEmptyRepo(
  repoPath: string,
  ref: string,
): Promise<BootstrapResult> {
  if (!(await isEmptySkillRepo(repoPath))) {
    const { artifacts, skillLayout } = await scanRepo(repoPath);
    return {
      applied: false,
      pushed: false,
      skillCount: artifacts.filter((a) => a.kind === "skill").length,
      agentCount: artifacts.filter((a) => a.kind === "agent").length,
      skillLayout,
    };
  }

  await applyTemplateToRepo(repoPath);

  let pushed = false;
  let pushError: string | undefined;
  try {
    await commitAndPushRepo(repoPath, ref);
    pushed = true;
  } catch (err) {
    pushError = err instanceof Error ? err.message : String(err);
  }

  const { artifacts, skillLayout } = await scanRepo(repoPath);
  return {
    applied: true,
    pushed,
    pushError,
    skillCount: artifacts.filter((a) => a.kind === "skill").length,
    agentCount: artifacts.filter((a) => a.kind === "agent").length,
    skillLayout,
  };
}
