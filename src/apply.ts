import { lstat, mkdir, readlink, symlink, unlink } from "node:fs/promises";
import path from "node:path";
import { getEnabledAdapters } from "./adapters/index.js";
import {
  addManagedGitignoreEntry,
  removeManagedGitignoreEntry,
  toGitignorePath,
} from "./gitignore.js";
import { getRepoPath, resolveProjectPath } from "./paths.js";
import type { IdeAgentsConfig, ApplyResult, ApplyResultItem } from "./types.js";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function removeSymlinkIfExists(targetPath: string): Promise<ApplyResultItem> {
  if (!(await pathExists(targetPath))) {
    return { path: targetPath, action: "skipped" };
  }

  const stats = await lstat(targetPath);
  if (!stats.isSymbolicLink()) {
    return {
      path: targetPath,
      action: "skipped",
      error: "Target exists and is not a symlink",
    };
  }

  await unlink(targetPath);
  return { path: targetPath, action: "removed" };
}

async function createSymlink(
  targetPath: string,
  sourcePath: string,
  type: "dir" | "file",
): Promise<ApplyResultItem> {
  const resolvedSource = path.resolve(sourcePath);

  if (await pathExists(targetPath)) {
    const stats = await lstat(targetPath);
    if (stats.isSymbolicLink()) {
      const current = await readlink(targetPath);
      if (path.resolve(path.dirname(targetPath), current) === resolvedSource) {
        return { path: targetPath, action: "skipped" };
      }
      await unlink(targetPath);
    } else {
      return {
        path: targetPath,
        action: "skipped",
        error: "Target exists and is not a symlink",
      };
    }
  }

  await ensureParentDir(targetPath);
  await symlink(resolvedSource, targetPath, type);
  return { path: targetPath, action: "created" };
}

async function syncProjectGitignore(
  projectRoot: string | null,
  targetPath: string,
  mode: "add" | "remove",
): Promise<void> {
  if (!projectRoot) {
    return;
  }

  const entry = toGitignorePath(projectRoot, targetPath);
  if (!entry) {
    return;
  }

  if (mode === "add") {
    await addManagedGitignoreEntry(projectRoot, entry);
    return;
  }

  await removeManagedGitignoreEntry(projectRoot, entry);
}

async function applyScope(
  sourcePath: string,
  type: "dir" | "file",
  enabled: boolean,
  targetPath: string,
  projectRoot: string | null,
): Promise<ApplyResultItem[]> {
  const results: ApplyResultItem[] = [];
  if (enabled) {
    try {
      const result = await createSymlink(targetPath, sourcePath, type);
      results.push(result);
      if (!result.error) {
        await syncProjectGitignore(projectRoot, targetPath, "add");
      }
    } catch (err) {
      results.push({
        path: targetPath,
        action: "skipped",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return results;
  }

  const removed = await removeSymlinkIfExists(targetPath);
  if (removed.action === "removed") {
    results.push(removed);
    await syncProjectGitignore(projectRoot, targetPath, "remove");
  }
  return results;
}

function installationKey(installation: {
  repoId: string;
  kind: string;
  artifactId: string;
}): string {
  return `${installation.repoId}:${installation.kind}:${installation.artifactId}`;
}

/** Remove symlinks for an installation (e.g. dropped from config). */
export async function removeInstallationSymlinks(
  installation: IdeAgentsConfig["installations"][number],
  config: IdeAgentsConfig,
): Promise<ApplyResultItem[]> {
  const adapters = getEnabledAdapters(config);
  const results: ApplyResultItem[] = [];
  const repo = config.repos.find((r) => r.id === installation.repoId);
  if (!repo) {
    return results;
  }

  const repoRoot = getRepoPath(repo.slug);
  const type = installation.kind === "skill" ? "dir" : "file";

  for (const adapter of adapters) {
    const sourcePath = adapter.getSourcePath(repoRoot, installation);
    const globalTarget = adapter.getGlobalTargetPath(installation);

    results.push(
      ...(await applyScope(sourcePath, type, false, globalTarget, null)),
    );

    if (installation.projectPath) {
      const projectRoot = resolveProjectPath(installation.projectPath);
      const projectTarget = adapter.getProjectTargetPath(installation);
      results.push(
        ...(await applyScope(
          sourcePath,
          type,
          false,
          projectTarget,
          projectRoot,
        )),
      );
    }
  }

  return results;
}

export function findRemovedInstallations(
  previous: IdeAgentsConfig["installations"],
  next: IdeAgentsConfig["installations"],
): IdeAgentsConfig["installations"] {
  const nextKeys = new Set(next.map(installationKey));
  return previous.filter((i) => !nextKeys.has(installationKey(i)));
}

export async function applyInstallations(
  config: IdeAgentsConfig,
): Promise<ApplyResult> {
  const adapters = getEnabledAdapters(config);
  const results: ApplyResultItem[] = [];

  if (adapters.length === 0) {
    return { results };
  }

  for (const installation of config.installations) {
    const repo = config.repos.find((r) => r.id === installation.repoId);
    if (!repo) {
      results.push({
        path: installation.targetName,
        action: "skipped",
        error: `Unknown repo: ${installation.repoId}`,
      });
      continue;
    }

    const repoRoot = getRepoPath(repo.slug);
    const type = installation.kind === "skill" ? "dir" : "file";

    for (const adapter of adapters) {
      const sourcePath = adapter.getSourcePath(repoRoot, installation);
      const globalTarget = adapter.getGlobalTargetPath(installation);

      results.push(
        ...(await applyScope(
          sourcePath,
          type,
          installation.global,
          globalTarget,
          null,
        )),
      );

      // projectPath is kept in config while project is off so removal can run.
      if (installation.projectPath) {
        const projectRoot = resolveProjectPath(installation.projectPath);
        const projectTarget = adapter.getProjectTargetPath(installation);
        results.push(
          ...(await applyScope(
            sourcePath,
            type,
            installation.project,
            projectTarget,
            projectRoot,
          )),
        );
      }
    }
  }

  return { results };
}
