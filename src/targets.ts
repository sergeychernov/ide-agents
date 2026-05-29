import { lstat } from "node:fs/promises";
import { getAdapter } from "./adapters/cursor.js";
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

export async function getArtifactTargets(
  artifact: Pick<Artifact, "kind" | "id">,
  projectPath: string | null,
  adapterId: string,
): Promise<ArtifactTargets> {
  const adapter = getAdapter(adapterId);
  const installation = {
    kind: artifact.kind,
    targetName: artifact.id,
    projectPath,
  };

  const global = await getTargetStatus(
    adapter.getGlobalTargetPath(installation),
  );

  let project: TargetStatus | null = null;
  if (projectPath) {
    project = await getTargetStatus(
      adapter.getProjectTargetPath(installation),
    );
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
