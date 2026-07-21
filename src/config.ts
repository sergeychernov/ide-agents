import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { getConfigPath, getIdeAgentsHome } from "./paths.js";
import {
  defaultAdapterFromIdes,
  getDefaultIdes,
  migrateIdesConfig,
} from "./ides.js";
import {
  installationNeedsScopesMigration,
  migrateInstallation,
} from "./install-scopes.js";
import type { IdeAgentsConfig, RepoConfig } from "./types.js";

function buildDefaultConfig(): IdeAgentsConfig {
  const ides = getDefaultIdes();
  return {
    version: 1,
    adapter: defaultAdapterFromIdes(ides),
    ides,
    server: { port: 3921 },
    repos: [],
    installations: [],
    recentProjects: [],
  };
}

const LEGACY_HOME = path.join(homedir(), ".agentdesk");

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isLegacySampleRepo(repo: RepoConfig): boolean {
  if (repo.id === "sample") {
    return true;
  }
  const normalized = repo.url.toLowerCase();
  return (
    normalized.includes("fixtures/sample-repo") ||
    normalized.includes("fixtures%2fsample-repo")
  );
}

function stripLegacySampleRepo(config: IdeAgentsConfig): IdeAgentsConfig {
  const repos = config.repos.filter((r) => !isLegacySampleRepo(r));
  if (repos.length === config.repos.length) {
    return config;
  }
  const removedIds = new Set(
    config.repos.filter(isLegacySampleRepo).map((r) => r.id),
  );
  return {
    ...config,
    repos,
    installations: config.installations.filter((i) => !removedIds.has(i.repoId)),
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

  const defaults = buildDefaultConfig();

  if (!(await fileExists(configPath))) {
    await writeConfig(defaults);
    return structuredClone(defaults);
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as IdeAgentsConfig;
  const ides = migrateIdesConfig(parsed);
  const rawInstallations = parsed.installations ?? [];
  const installations = rawInstallations.map(migrateInstallation);
  let config: IdeAgentsConfig = {
    ...defaults,
    ...parsed,
    adapter: parsed.adapter ?? defaultAdapterFromIdes(ides),
    ides,
    server: { ...defaults.server, ...parsed.server },
    repos: parsed.repos ?? [],
    installations,
    recentProjects: parsed.recentProjects ?? [],
  };
  const withoutSample = stripLegacySampleRepo(config);
  const needsScopesMigration = rawInstallations.some(installationNeedsScopesMigration);
  if (withoutSample.repos.length !== config.repos.length || needsScopesMigration) {
    await writeConfig(withoutSample);
    config = withoutSample;
  }
  return config;
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
