import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureIdeAgentsHome } from "./config.js";
import { getIdeAgentsHome } from "./paths.js";
import { PACKAGE_VERSION } from "./version.js";
import type { NpmUpdateInfo } from "./shared/api-types.js";

export type { NpmUpdateInfo } from "./shared/api-types.js";

export const NPM_PACKAGE_NAME = "ide-agents";

const REGISTRY_URL = `https://registry.npmjs.org/${NPM_PACKAGE_NAME}/latest`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

interface UpdateCache {
  checkedAt: number;
  latest: string | null;
}

function getCachePath(): string {
  return path.join(getIdeAgentsHome(), "npm-update-check.json");
}

function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) {
      return true;
    }
    if (a[i]! < b[i]!) {
      return false;
    }
  }
  return false;
}

async function readCache(): Promise<UpdateCache | null> {
  try {
    const raw = await readFile(getCachePath(), "utf8");
    const parsed = JSON.parse(raw) as UpdateCache;
    if (
      typeof parsed.checkedAt !== "number" ||
      (parsed.latest !== null && typeof parsed.latest !== "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(latest: string | null): Promise<void> {
  await ensureIdeAgentsHome();
  const cache: UpdateCache = { checkedAt: Date.now(), latest };
  await writeFile(getCachePath(), `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(REGISTRY_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { version?: string };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

async function resolveLatestVersion(skipCache: boolean): Promise<string | null> {
  if (!skipCache) {
    const cache = await readCache();
    if (cache && Date.now() - cache.checkedAt < CACHE_TTL_MS) {
      return cache.latest;
    }
  }

  const latest = await fetchLatestVersion();
  await writeCache(latest);
  return latest;
}

export async function checkNpmUpdate(options?: {
  skipCache?: boolean;
}): Promise<NpmUpdateInfo> {
  const current = PACKAGE_VERSION;
  const installCommand = `npm update -g ${NPM_PACKAGE_NAME}`;
  const latest = await resolveLatestVersion(options?.skipCache ?? false);
  const updateAvailable =
    latest !== null && isNewerVersion(latest, current);

  return {
    current,
    latest,
    updateAvailable,
    installCommand,
  };
}

export function formatCliUpdateMessage(info: NpmUpdateInfo): string {
  if (!info.updateAvailable || !info.latest) {
    return "";
  }
  return [
    `ide-agents v${info.current} — доступна v${info.latest}`,
    `  ${info.installCommand}`,
  ].join("\n");
}
