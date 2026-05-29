import path from "node:path";
import { homedir } from "node:os";
import type { ArtifactKind, Installation } from "../types.js";
import { resolveProjectPath } from "../paths.js";

export interface Adapter {
  id: "cursor";
  getGlobalTargetPath(installation: Pick<Installation, "kind" | "targetName">): string;
  getProjectTargetPath(
    installation: Pick<Installation, "kind" | "targetName" | "projectPath">,
  ): string;
  getSourcePath(
    repoRoot: string,
    installation: Pick<Installation, "sourcePath">,
  ): string;
}

function skillsDir(base: string): string {
  return path.join(base, ".cursor", "skills");
}

function agentsDir(base: string): string {
  return path.join(base, ".cursor", "agents");
}

function targetPath(
  base: string,
  kind: ArtifactKind,
  targetName: string,
): string {
  if (kind === "skill") {
    return path.join(skillsDir(base), targetName);
  }
  return path.join(agentsDir(base), `${targetName}.md`);
}

export const cursorAdapter: Adapter = {
  id: "cursor",

  getGlobalTargetPath(installation) {
    return targetPath(homedir(), installation.kind, installation.targetName);
  },

  getProjectTargetPath(installation) {
    if (!installation.projectPath) {
      throw new Error("projectPath is required for project target");
    }
    return targetPath(
      resolveProjectPath(installation.projectPath),
      installation.kind,
      installation.targetName,
    );
  },

  getSourcePath(repoRoot, installation) {
    return path.join(repoRoot, installation.sourcePath);
  },
};

export function getAdapter(adapterId: string): Adapter {
  if (adapterId === "cursor") {
    return cursorAdapter;
  }
  throw new Error(`Unknown adapter: ${adapterId}`);
}

export function isSymlinkType(kind: ArtifactKind): "dir" | "file" {
  return kind === "skill" ? "dir" : "file";
}
