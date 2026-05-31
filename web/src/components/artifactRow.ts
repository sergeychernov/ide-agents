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

function agentsBlockingSkill(
  skillId: string,
  rows: ArtifactRow[],
  scope: "global" | "project",
): ArtifactRow[] {
  return rows.filter(
    (row) =>
      row.artifact.kind === "agent" &&
      row.artifact.dependsOnSkills?.includes(skillId) &&
      (scope === "global" ? row.global : row.project),
  );
}

export function isGlobalDisabled(
  row: ArtifactRow,
  rows: ArtifactRow[] = [],
): boolean {
  if (row.global) {
    if (row.artifact.kind === "skill") {
      return agentsBlockingSkill(row.artifact.id, rows, "global").length > 0;
    }
    return false;
  }

  if (!scopeAllowsGlobal(row.artifact.allowedScope)) return true;
  return row.artifact.targets?.global.blocked ?? false;
}

export function isProjectDisabled(
  row: ArtifactRow,
  rows: ArtifactRow[] = [],
): boolean {
  if (row.project) {
    if (row.artifact.kind === "skill") {
      return agentsBlockingSkill(row.artifact.id, rows, "project").length > 0;
    }
    return false;
  }

  if (!scopeAllowsProject(row.artifact.allowedScope)) return true;
  if (!row.projectPath.trim()) return true;
  return row.artifact.targets?.project?.blocked ?? false;
}

export function globalDisabledReason(
  row: ArtifactRow,
  rows: ArtifactRow[] = [],
): string | undefined {
  if (!isGlobalDisabled(row, rows)) return undefined;

  if (row.global && row.artifact.kind === "skill") {
    const blocking = agentsBlockingSkill(row.artifact.id, rows, "global");
    if (blocking.length > 0) {
      const names = blocking.map((agent) => agent.artifact.name).join(", ");
      return `Required by installed agent${blocking.length > 1 ? "s" : ""}: ${names}`;
    }
  }

  if (row.artifact.targets?.global.blocked) {
    return "A regular folder/file already exists at the global path";
  }
  if (!row.artifact.allowedScope) {
    return "Set scope in SKILL.md frontmatter";
  }
  return "Not allowed by skill scope";
}

export function projectDisabledReason(
  row: ArtifactRow,
  rows: ArtifactRow[] = [],
): string | undefined {
  if (!isProjectDisabled(row, rows)) return undefined;

  if (row.project && row.artifact.kind === "skill") {
    const blocking = agentsBlockingSkill(row.artifact.id, rows, "project");
    if (blocking.length > 0) {
      const names = blocking.map((agent) => agent.artifact.name).join(", ");
      return `Required by installed agent${blocking.length > 1 ? "s" : ""}: ${names}`;
    }
  }

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

export function applyAgentInstallDependencies(
  rows: ArtifactRow[],
  agentId: string,
  patch: Partial<ArtifactRow>,
  defaultProjectPath: string,
): ArtifactRow[] {
  const agentRow = rows.find((row) => row.artifact.id === agentId);
  if (!agentRow || agentRow.artifact.kind !== "agent") {
    return rows.map((row) =>
      row.artifact.id === agentId ? { ...row, ...patch } : row,
    );
  }

  const dependsOnSkills = agentRow.artifact.dependsOnSkills ?? [];
  const enablingGlobal = patch.global === true;
  const enablingProject = patch.project === true;

  if (!enablingGlobal && !enablingProject) {
    return rows.map((row) =>
      row.artifact.id === agentId ? { ...row, ...patch } : row,
    );
  }

  return rows.map((row) => {
    if (row.artifact.id === agentId) {
      return { ...row, ...patch };
    }

    if (
      row.artifact.kind !== "skill" ||
      !dependsOnSkills.includes(row.artifact.id)
    ) {
      return row;
    }

    let next = row;

    if (enablingGlobal && !row.global) {
      if (!scopeAllowsGlobal(row.artifact.allowedScope)) {
        return row;
      }
      if (row.artifact.targets?.global.blocked) {
        return row;
      }
      next = { ...next, global: true };
    }

    if (enablingProject && !row.project) {
      if (!scopeAllowsProject(row.artifact.allowedScope)) {
        return next;
      }
      const projectPath =
        patch.projectPath?.trim() ||
        defaultProjectPath ||
        row.projectPath;
      if (!projectPath.trim()) {
        return next;
      }
      if (row.artifact.targets?.project?.blocked) {
        return next;
      }
      next = { ...next, project: true, projectPath };
    }

    return next;
  });
}
