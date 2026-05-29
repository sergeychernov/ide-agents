import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { getConfigPath, getIdeAgentsHome } from "./paths.js";
import type { IdeAgentsConfig, Installation } from "./types.js";

const DEFAULT_CONFIG: IdeAgentsConfig = {
  version: 1,
  adapter: "cursor",
  server: { port: 3921 },
  repos: [],
  installations: [],
  recentProjects: [],
};

const LEGACY_HOME = path.join(homedir(), ".agentdesk");

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function migrateInstallation(raw: unknown): Installation {
  const item = raw as Installation & { scope?: string };
  if (typeof item.global === "boolean") {
    return item;
  }

  const scope = item.scope;
  return {
    id: item.id,
    repoId: item.repoId,
    kind: item.kind,
    artifactId: item.artifactId,
    sourcePath: item.sourcePath,
    targetName: item.targetName,
    global: scope === "global",
    project: scope === "project",
    projectPath: item.projectPath ?? null,
  };
}

async function migrateLegacyHome(): Promise<void> {
  const home = getIdeAgentsHome();
  if (home === LEGACY_HOME) {
    return;
  }
  if (!(await fileExists(home)) && (await fileExists(LEGACY_HOME))) {
    await rename(LEGACY_HOME, home);
  }
}

export async function ensureIdeAgentsHome(): Promise<string> {
  await migrateLegacyHome();
  const home = getIdeAgentsHome();
  await mkdir(home, { recursive: true });
  await mkdir(path.join(home, "repos"), { recursive: true });
  return home;
}

export async function readConfig(): Promise<IdeAgentsConfig> {
  await ensureIdeAgentsHome();
  const configPath = getConfigPath();

  if (!(await fileExists(configPath))) {
    await writeConfig(DEFAULT_CONFIG);
    return structuredClone(DEFAULT_CONFIG);
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as IdeAgentsConfig;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    server: { ...DEFAULT_CONFIG.server, ...parsed.server },
    repos: parsed.repos ?? [],
    installations: (parsed.installations ?? []).map(migrateInstallation),
    recentProjects: parsed.recentProjects ?? [],
  };
}

export async function writeConfig(config: IdeAgentsConfig): Promise<void> {
  await ensureIdeAgentsHome();
  await writeFile(getConfigPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function addRecentProject(
  config: IdeAgentsConfig,
  projectPath: string,
): Promise<IdeAgentsConfig> {
  const resolved = path.resolve(projectPath);
  const recent = [
    resolved,
    ...config.recentProjects.filter((p) => p !== resolved),
  ].slice(0, 10);
  return { ...config, recentProjects: recent };
}
