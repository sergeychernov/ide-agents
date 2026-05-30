import type { ArtifactKind, IdeId, Installation } from "../types.js";

export interface Adapter {
  id: IdeId;
  getGlobalTargetPath(installation: Pick<Installation, "kind" | "targetName">): string;
  getProjectTargetPath(
    installation: Pick<Installation, "kind" | "targetName" | "projectPath">,
  ): string;
  getSourcePath(
    repoRoot: string,
    installation: Pick<Installation, "sourcePath">,
  ): string;
}
