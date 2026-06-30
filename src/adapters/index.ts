import type { IdeAgentsConfig, IdeId } from "../types.js";
import { getEnabledIdeIds } from "../ides.js";
import { createAdapter } from "./create.js";
import type { Adapter } from "./types.js";

const LAYOUTS = {
  cursor: { id: "cursor" as const, projectDir: ".cursor" },
  claude: { id: "claude" as const, projectDir: ".claude" },
  codex: { id: "codex" as const, projectDir: ".agents" },
  opencode: { id: "opencode" as const, projectDir: ".opencode" },
} as const;

export function getAdapter(ideId: IdeId, configPath: string): Adapter {
  return createAdapter(LAYOUTS[ideId], configPath);
}

export function getEnabledAdapters(config: IdeAgentsConfig): Adapter[] {
  return getEnabledIdeIds(config).map((id) =>
    getAdapter(id, config.ides[id].configPath),
  );
}

export function isSymlinkType(kind: "skill" | "agent"): "dir" | "file" {
  return kind === "skill" ? "dir" : "file";
}

export type { Adapter } from "./types.js";
