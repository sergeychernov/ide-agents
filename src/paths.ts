import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function getIdeAgentsHome(): string {
  return path.join(homedir(), ".ide-agents");
}

export function getConfigPath(): string {
  return path.join(getIdeAgentsHome(), "config.json");
}

export function getStatePath(): string {
  return path.join(getIdeAgentsHome(), "state.json");
}

export function getReposDir(): string {
  return path.join(getIdeAgentsHome(), "repos");
}

export function getRepoPath(slug: string): string {
  return path.join(getReposDir(), slug);
}

export function slugFromUrl(url: string): string {
  const normalized = url
    .replace(/^git@([^:]+):(.+)\.git$/, "https://$1/$2")
    .replace(/^file:\/\//, "file://")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  if (normalized.startsWith("file://")) {
    const localPath = normalized.slice("file://".length);
    return localPath
      .replace(/^\/+/, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "local-repo";
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/\./g, "-");
    const pathname = parsed.pathname
      .replace(/^\//, "")
      .replace(/\//g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return `${host}-${pathname}`.toLowerCase();
  } catch {
    return normalized
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  }
}

export function getWebDistDir(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "../web/dist");
}

export function resolveProjectPath(projectPath: string): string {
  return path.resolve(projectPath);
}
