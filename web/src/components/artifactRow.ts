import type { Artifact, ArtifactAllowedScope } from "../api/client";

export interface ArtifactRow {
  artifact: Artifact;
  global: boolean;
  project: boolean;
  projectPath: string;
  installationId: string | null;
}

export function scopeAllowsGlobal(
  allowedScope: ArtifactAllowedScope | null,
): boolean {
  return allowedScope === "global" || allowedScope === "any";
}

export function scopeAllowsProject(
  allowedScope: ArtifactAllowedScope | null,
): boolean {
  return allowedScope === "project" || allowedScope === "any";
}

export function isGlobalDisabled(row: ArtifactRow): boolean {
  if (!scopeAllowsGlobal(row.artifact.allowedScope)) return true;
  return row.artifact.targets?.global.blocked ?? false;
}

export function isProjectDisabled(row: ArtifactRow): boolean {
  if (!scopeAllowsProject(row.artifact.allowedScope)) return true;
  if (!row.projectPath.trim()) return true;
  return row.artifact.targets?.project?.blocked ?? false;
}

export function globalDisabledReason(row: ArtifactRow): string | undefined {
  if (!isGlobalDisabled(row)) return undefined;
  if (row.artifact.targets?.global.blocked) {
    return "A regular folder/file already exists at the global path";
  }
  if (!row.artifact.allowedScope) {
    return "Set scope in SKILL.md frontmatter";
  }
  return "Not allowed by skill scope";
}

export function projectDisabledReason(row: ArtifactRow): string | undefined {
  if (!isProjectDisabled(row)) return undefined;
  if (row.artifact.targets?.project?.blocked) {
    return "A regular folder/file already exists at the project path";
  }
  if (!row.artifact.allowedScope) {
    return "Set scope in SKILL.md frontmatter";
  }
  if (row.artifact.allowedScope === "global") {
    return "Skill is global-only";
  }
  if (!row.projectPath.trim()) {
    return "Enter a project path";
  }
  return "Not allowed by skill scope";
}
