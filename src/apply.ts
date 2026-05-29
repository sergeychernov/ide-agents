import { lstat, mkdir, readlink, symlink, unlink } from "node:fs/promises";
import path from "node:path";
import { getAdapter } from "./adapters/cursor.js";
import { getRepoPath } from "./paths.js";
import type {
  IdeAgentsConfig,
  ApplyResult,
  ApplyResultItem,
  Installation,
} from "./types.js";

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

async function applyScope(
  installation: Installation,
  sourcePath: string,
  type: "dir" | "file",
  enabled: boolean,
  targetPath: string,
): Promise<ApplyResultItem[]> {
  const results: ApplyResultItem[] = [];
  if (enabled) {
    try {
      results.push(await createSymlink(targetPath, sourcePath, type));
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
  }
  return results;
}

export async function applyInstallations(
  config: IdeAgentsConfig,
): Promise<ApplyResult> {
  const adapter = getAdapter(config.adapter);
  const results: ApplyResultItem[] = [];

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
    const sourcePath = adapter.getSourcePath(repoRoot, installation);
    const type = installation.kind === "skill" ? "dir" : "file";
    const globalTarget = adapter.getGlobalTargetPath(installation);

    results.push(
      ...(await applyScope(
        installation,
        sourcePath,
        type,
        installation.global,
        globalTarget,
      )),
    );

    // projectPath is kept in config while project is off so removal can run.
    if (installation.projectPath) {
      const projectTarget = adapter.getProjectTargetPath(installation);
      results.push(
        ...(await applyScope(
          installation,
          sourcePath,
          type,
          installation.project,
          projectTarget,
        )),
      );
    }
  }

  return { results };
}
