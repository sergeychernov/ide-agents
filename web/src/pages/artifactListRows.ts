import type { Artifact, Installation } from "../api/client";
import type { ArtifactRow } from "../components/artifactRow";

function normalizePath(projectPath: string): string {
  return projectPath.replace(/\/+$/, "") || projectPath;
}

export function buildRows(
  artifacts: Artifact[],
  installations: Installation[],
  repoId: string,
  defaultProjectPath: string,
): ArtifactRow[] {
  const resolvedCwd = defaultProjectPath
    ? normalizePath(defaultProjectPath)
    : "";

  return artifacts.map((artifact) => {
    const existing = installations.find(
      (i) =>
        i.repoId === repoId &&
        i.artifactId === artifact.id &&
        i.kind === artifact.kind,
    );
    const scopes = existing?.scopes ?? { global: false, projectPaths: [] };
    const normalizedPaths = scopes.projectPaths.map(normalizePath);

    return {
      artifact,
      global: scopes.global,
      project: resolvedCwd
        ? normalizedPaths.includes(resolvedCwd)
        : false,
      projectPath: defaultProjectPath,
      otherProjectPaths: resolvedCwd
        ? normalizedPaths.filter((p) => p !== resolvedCwd)
        : normalizedPaths,
      installationId: existing?.id ?? null,
    };
  });
}

export function rowsToInstallations(
  rows: ArtifactRow[],
  repoId: string,
  existing: Installation[],
  defaultProjectPath: string,
): Installation[] {
  const other = existing.filter((i) => i.repoId !== repoId);
  const previous = existing.filter((i) => i.repoId === repoId);
  const current: Installation[] = [];
  const resolvedCwd = defaultProjectPath
    ? normalizePath(defaultProjectPath)
    : null;

  for (const row of rows) {
    const prev = previous.find(
      (i) =>
        i.artifactId === row.artifact.id && i.kind === row.artifact.kind,
    );
    const prevPaths = (prev?.scopes.projectPaths ?? []).map(normalizePath);
    let projectPaths = [...prevPaths];

    if (row.project && resolvedCwd) {
      if (!projectPaths.includes(resolvedCwd)) {
        projectPaths.push(resolvedCwd);
      }
    } else if (!row.project && resolvedCwd && projectPaths.includes(resolvedCwd)) {
      projectPaths = projectPaths.filter((p) => p !== resolvedCwd);
    }

    current.push({
      id: row.installationId ?? crypto.randomUUID(),
      repoId,
      kind: row.artifact.kind,
      artifactId: row.artifact.id,
      sourcePath: row.artifact.sourcePath,
      targetName: row.artifact.id,
      scopes: {
        global: row.global,
        projectPaths,
      },
    });
  }

  return [...other, ...current];
}
