import type { IdeId, Installation, ProjectTargetRef } from "../types.js";

export interface Adapter {
  id: IdeId;
  getGlobalTargetPath(installation: Pick<Installation, "kind" | "targetName">): string;
  getProjectTargetPath(installation: ProjectTargetRef): string;
  getSourcePath(
    repoRoot: string,
    installation: Pick<Installation, "sourcePath">,
  ): string;
}
