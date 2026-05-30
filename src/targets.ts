import { lstat } from "node:fs/promises";
import { getEnabledAdapters } from "./adapters/index.js";
import type { IdeAgentsConfig } from "./types.js";
import type {
  Artifact,
  ArtifactTargets,
  Installation,
  TargetStatus,
} from "./types.js";

export async function getTargetStatus(targetPath: string): Promise<TargetStatus> {
  try {
    const stats = await lstat(targetPath);
    const isSymlink = stats.isSymbolicLink();
    return {
      exists: true,
      isSymlink,
      blocked: !isSymlink,
    };
  } catch {
    return {
      exists: false,
      isSymlink: false,
      blocked: false,
    };
  }
}

function mergeTargetStatus(
  current: TargetStatus,
  next: TargetStatus,
): TargetStatus {
  return {
    exists: current.exists || next.exists,
    isSymlink: current.isSymlink || next.isSymlink,
    blocked: current.blocked || next.blocked,
  };
}

export async function getArtifactTargets(
  artifact: Pick<Artifact, "kind" | "id">,
  projectPath: string | null,
  config: IdeAgentsConfig,
): Promise<ArtifactTargets> {
  const adapters = getEnabledAdapters(config);
  const installation = {
    kind: artifact.kind,
    targetName: artifact.id,
    projectPath,
  };

  let global: TargetStatus = {
    exists: false,
    isSymlink: false,
    blocked: false,
  };

  let project: TargetStatus | null = null;

  for (const adapter of adapters) {
    const globalStatus = await getTargetStatus(
      adapter.getGlobalTargetPath(installation),
    );
    global = mergeTargetStatus(global, globalStatus);

    if (projectPath) {
      const projectStatus = await getTargetStatus(
        adapter.getProjectTargetPath(installation),
      );
      project = project
        ? mergeTargetStatus(project, projectStatus)
        : projectStatus;
    }
  }

  return { global, project };
}

export function installationStub(
  artifact: Pick<Artifact, "kind" | "id" | "sourcePath">,
  projectPath: string | null,
): Pick<Installation, "kind" | "targetName" | "sourcePath" | "projectPath"> {
  return {
    kind: artifact.kind,
    targetName: artifact.id,
    sourcePath: artifact.sourcePath,
    projectPath,
  };
}
