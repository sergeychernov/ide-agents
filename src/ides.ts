import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { AdapterId, IdeAgentsConfig, IdeId, IdesConfig } from "./types.js";

function homeDirExists(dirPath: string): boolean {
  try {
    return existsSync(dirPath) && statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function getDefaultIdes(): IdesConfig {
  const home = homedir();
  const cursorPath = path.join(home, ".cursor");
  const claudePath = path.join(home, ".claude");
  const codexPath = path.join(home, ".codex");
  const opencodePath = path.join(home, ".config", "opencode");

  return {
    cursor: { enabled: homeDirExists(cursorPath), configPath: cursorPath },
    claude: { enabled: homeDirExists(claudePath), configPath: claudePath },
    codex: { enabled: homeDirExists(codexPath), configPath: codexPath },
    opencode: { enabled: homeDirExists(opencodePath), configPath: opencodePath },
  };
}

export function defaultAdapterFromIdes(ides: IdesConfig): AdapterId {
  if (ides.cursor.enabled) return "cursor";
  if (ides.claude.enabled) return "claude";
  if (ides.codex.enabled) return "codex";
  if (ides.opencode.enabled) return "opencode";
  return "cursor";
}

export function migrateIdesConfig(
  parsed: Partial<IdeAgentsConfig>,
): IdesConfig {
  const defaults = getDefaultIdes();
  if (!parsed.ides) {
    return defaults;
  }

  return {
    cursor: { ...defaults.cursor, ...parsed.ides.cursor },
    claude: { ...defaults.claude, ...parsed.ides.claude },
    codex: { ...defaults.codex, ...parsed.ides.codex },
    opencode: { ...defaults.opencode, ...parsed.ides.opencode },
  };
}

export function getEnabledIdeIds(config: IdeAgentsConfig): IdeId[] {
  const ids: IdeId[] = [];
  if (config.ides.cursor.enabled) ids.push("cursor");
  if (config.ides.claude.enabled) ids.push("claude");
  if (config.ides.codex.enabled) ids.push("codex");
  if (config.ides.opencode.enabled) ids.push("opencode");
  return ids;
}
