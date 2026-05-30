import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { access } from "node:fs/promises";
import { getRepoPath } from "./paths.js";
import type { GitStatus } from "./types.js";

const execFileAsync = promisify(execFile);

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await access(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function runGit(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

async function syncExistingRepo(target: string, ref: string): Promise<void> {
  try {
    await runGit(target, ["fetch", "--all", "--prune"]);
    try {
      await runGit(target, ["checkout", ref]);
    } catch {
      // ref may be a tag or detached state — pull current branch below
    }
    await runGit(target, ["pull", "--ff-only"]);
  } catch {
    // Best effort: re-attaching a previously removed repo still succeeds
  }
}

export async function cloneRepo(
  url: string,
  slug: string,
  ref: string,
): Promise<string> {
  const target = getRepoPath(slug);
  if (await isGitRepo(target)) {
    await syncExistingRepo(target, ref);
    return target;
  }

  await execFileAsync("git", ["clone", "--branch", ref, url, target], {
    maxBuffer: 10 * 1024 * 1024,
  }).catch(async (err: Error & { stderr?: string }) => {
    // Retry without --branch for repos where ref is not a branch at clone time
    try {
      await execFileAsync("git", ["clone", url, target], {
        maxBuffer: 10 * 1024 * 1024,
      });
      await runGit(target, ["checkout", ref]);
    } catch {
      throw new Error(err.stderr?.trim() || err.message);
    }
  });

  return target;
}

export async function fetchRepo(slug: string): Promise<void> {
  const cwd = getRepoPath(slug);
  if (!(await isGitRepo(cwd))) {
    throw new Error(`Not a git repository: ${cwd}`);
  }
  await runGit(cwd, ["fetch", "--all", "--prune"]);
}

export async function pullRepo(slug: string): Promise<void> {
  const cwd = getRepoPath(slug);
  if (!(await isGitRepo(cwd))) {
    throw new Error(`Not a git repository: ${cwd}`);
  }
  await runGit(cwd, ["pull", "--ff-only"]);
}

export async function getGitStatus(slug: string, ref: string): Promise<GitStatus> {
  const cwd = getRepoPath(slug);

  if (!(await isGitRepo(cwd))) {
    return {
      branch: null,
      sha: null,
      dirty: false,
      behind: null,
      ahead: null,
      error: "Repository not cloned",
    };
  }

  try {
    const branchResult = await runGit(cwd, [
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    const shaResult = await runGit(cwd, ["rev-parse", "HEAD"]);
    const dirtyResult = await runGit(cwd, ["status", "--porcelain"]);

    let behind: number | null = null;
    let ahead: number | null = null;

    try {
      await runGit(cwd, ["fetch", "--quiet"]);
      const revList = await runGit(cwd, [
        "rev-list",
        "--left-right",
        "--count",
        `HEAD...origin/${ref}`,
      ]);
      const [aheadStr, behindStr] = revList.stdout.split(/\s+/);
      ahead = Number.parseInt(aheadStr ?? "0", 10);
      behind = Number.parseInt(behindStr ?? "0", 10);
    } catch {
      // Remote tracking may not exist yet
      behind = null;
      ahead = null;
    }

    return {
      branch: branchResult.stdout || null,
      sha: shaResult.stdout || null,
      dirty: dirtyResult.stdout.length > 0,
      behind,
      ahead,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      branch: null,
      sha: null,
      dirty: false,
      behind: null,
      ahead: null,
      error: message,
    };
  }
}

export async function getGitStatusWithoutFetch(
  slug: string,
  ref: string,
): Promise<GitStatus> {
  const cwd = getRepoPath(slug);

  if (!(await isGitRepo(cwd))) {
    return {
      branch: null,
      sha: null,
      dirty: false,
      behind: null,
      ahead: null,
      error: "Repository not cloned",
    };
  }

  try {
    const branchResult = await runGit(cwd, [
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    const shaResult = await runGit(cwd, ["rev-parse", "HEAD"]);
    const dirtyResult = await runGit(cwd, ["status", "--porcelain"]);

    let behind: number | null = null;
    let ahead: number | null = null;

    try {
      const revList = await runGit(cwd, [
        "rev-list",
        "--left-right",
        "--count",
        `HEAD...origin/${ref}`,
      ]);
      const [aheadStr, behindStr] = revList.stdout.split(/\s+/);
      ahead = Number.parseInt(aheadStr ?? "0", 10);
      behind = Number.parseInt(behindStr ?? "0", 10);
    } catch {
      behind = null;
      ahead = null;
    }

    return {
      branch: branchResult.stdout || null,
      sha: shaResult.stdout || null,
      dirty: dirtyResult.stdout.length > 0,
      behind,
      ahead,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      branch: null,
      sha: null,
      dirty: false,
      behind: null,
      ahead: null,
      error: message,
    };
  }
}
