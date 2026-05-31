import type {
  Artifact,
  ArtifactAllowedScope,
  Installation,
} from "../api/client";

export function artifactRowKey(artifact: Pick<Artifact, "id" | "kind">): string {
  return `${artifact.kind}:${artifact.id}`;
}

export function findInstallation(
  installations: Installation[],
  repoId: string,
  artifact: Pick<Artifact, "id" | "kind">,
): Installation | undefined {
  return installations.find(
    (i) =>
      i.repoId === repoId &&
      i.artifactId === artifact.id &&
      i.kind === artifact.kind,
  );
}

export function findArtifactRow(
  rows: ArtifactRow[],
  artifact: Pick<Artifact, "id" | "kind">,
): ArtifactRow | undefined {
  const key = artifactRowKey(artifact);
  return rows.find((row) => artifactRowKey(row.artifact) === key);
}

export interface ArtifactRow {
  artifact: Artifact;
  global: boolean;
  project: boolean;
  projectPath: string;
  installationId: string | null;
}

export function isArtifactInstalled(row: ArtifactRow): boolean {
  return row.global || row.project;
}

export type InstallScope = "global" | "project";

export function installedAgentsUsingSkillInScope(
  skillId: string,
  rows: ArtifactRow[],
  scope: InstallScope,
  excludeAgentId?: string,
): ArtifactRow[] {
  return rows.filter(
    (row) =>
      row.artifact.kind === "agent" &&
      row.artifact.id !== excludeAgentId &&
      row.artifact.dependsOnSkills?.includes(skillId) &&
      (scope === "global" ? row.global : row.project),
  );
}

/** Dependent skills installed in this scope that no other agent uses in the same scope. */
export function deletableDependentSkillsForAgentInScope(
  agentRow: ArtifactRow,
  rows: ArtifactRow[],
  scope: InstallScope,
): ArtifactRow[] {
  if (agentRow.artifact.kind !== "agent") return [];

  const dependsOn = agentRow.artifact.dependsOnSkills ?? [];
  const result: ArtifactRow[] = [];

  for (const skillId of dependsOn) {
    const skillRow = rows.find(
      (row) => row.artifact.kind === "skill" && row.artifact.id === skillId,
    );
    if (!skillRow) continue;
    if (scope === "global" ? !skillRow.global : !skillRow.project) continue;
    if (
      installedAgentsUsingSkillInScope(
        skillId,
        rows,
        scope,
        agentRow.artifact.id,
      ).length > 0
    ) {
      continue;
    }
    result.push(skillRow);
  }

  return result;
}

export function buildAgentScopeOffPatches(
  agentRow: ArtifactRow,
  scope: InstallScope,
  agentPatch: Partial<ArtifactRow>,
  skillIdsToRemove: string[],
): Record<string, Partial<ArtifactRow>> {
  const patches: Record<string, Partial<ArtifactRow>> = {
    [artifactRowKey(agentRow.artifact)]: agentPatch,
  };
  const skillPatch: Partial<ArtifactRow> =
    scope === "global" ? { global: false } : { project: false };
  for (const skillId of skillIdsToRemove) {
    patches[artifactRowKey({ kind: "skill", id: skillId })] = skillPatch;
  }
  return patches;
}

export function applyPatchesToRows(
  rows: ArtifactRow[],
  patchesByKey: Record<string, Partial<ArtifactRow>>,
  defaultProjectPath: string,
): ArtifactRow[] {
  let next = rows.map((row) => {
    const patch = patchesByKey[artifactRowKey(row.artifact)];
    if (!patch) return row;
    const updated = { ...row, ...patch };
    if (
      patch.projectPath !== undefined &&
      !updated.projectPath.trim() &&
      defaultProjectPath
    ) {
      updated.projectPath = defaultProjectPath;
    }
    return updated;
  });

  for (const [key, patch] of Object.entries(patchesByKey)) {
    const agentId = key.startsWith("agent:") ? key.slice("agent:".length) : null;
    if (!agentId) continue;
    next = applyAgentInstallDependencies(
      next,
      agentId,
      patch,
      defaultProjectPath,
    );
  }

  return next;
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
  scope: InstallScope,
): ArtifactRow[] {
  return installedAgentsUsingSkillInScope(skillId, rows, scope);
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

function isAgentRow(row: ArtifactRow, agentId: string): boolean {
  return row.artifact.kind === "agent" && row.artifact.id === agentId;
}

export function applyAgentInstallDependencies(
  rows: ArtifactRow[],
  agentId: string,
  patch: Partial<ArtifactRow>,
  defaultProjectPath: string,
): ArtifactRow[] {
  const agentRow = rows.find((row) => isAgentRow(row, agentId));
  if (!agentRow) {
    return rows.map((row) =>
      isAgentRow(row, agentId) ? { ...row, ...patch } : row,
    );
  }

  const dependsOnSkills = agentRow.artifact.dependsOnSkills ?? [];
  const enablingGlobal = patch.global === true;
  const enablingProject = patch.project === true;

  if (!enablingGlobal && !enablingProject) {
    return rows.map((row) =>
      isAgentRow(row, agentId) ? { ...row, ...patch } : row,
    );
  }

  return rows.map((row) => {
    if (isAgentRow(row, agentId)) {
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
