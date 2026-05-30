import path from "node:path";
import type { ArtifactKind, IdeId } from "../types.js";
import { expandUserPath, resolveProjectPath } from "../paths.js";
import type { Adapter } from "./types.js";

interface IdeLayout {
  id: IdeId;
  /** Subfolder under a project root for project-scoped installs. */
  projectDir: string;
}

function skillsDir(base: string): string {
  return path.join(base, "skills");
}

function agentsDir(base: string): string {
  return path.join(base, "agents");
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

export function createAdapter(
  layout: IdeLayout,
  configPath: string,
): Adapter {
  const globalBase = expandUserPath(configPath);

  return {
    id: layout.id,

    getGlobalTargetPath(installation) {
      return targetPath(globalBase, installation.kind, installation.targetName);
    },

    getProjectTargetPath(installation) {
      if (!installation.projectPath) {
        throw new Error("projectPath is required for project target");
      }
      const projectBase = path.join(
        resolveProjectPath(installation.projectPath),
        layout.projectDir,
      );
      return targetPath(projectBase, installation.kind, installation.targetName);
    },

    getSourcePath(repoRoot, installation) {
      return path.join(repoRoot, installation.sourcePath);
    },
  };
}
