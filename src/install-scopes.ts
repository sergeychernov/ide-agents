import path from "node:path";
import type { Installation, InstallationScopes } from "./types.js";

type LegacyInstallation = {
  id: string;
  repoId: string;
  kind: Installation["kind"];
  artifactId: string;
  sourcePath: string;
  targetName: string;
  scopes?: InstallationScopes;
  scope?: string;
  global?: boolean;
  project?: boolean;
  projectPath?: string | null;
};

export function installationNeedsScopesMigration(raw: unknown): boolean {
  const item = raw as LegacyInstallation;
  return !item.scopes;
}

function scopesFromLegacy(item: LegacyInstallation): InstallationScopes {
  if (item.scopes) {
    return normalizeInstallationScopes(item.scopes);
  }

  let global = false;
  let projectPaths: string[] = [];

  if (typeof item.global === "boolean") {
    global = item.global;
    if (item.project === true && item.projectPath) {
      projectPaths = [normalizeProjectPath(item.projectPath)];
    }
  } else {
    const scope = item.scope;
    global = scope === "global";
    if (scope === "project" && item.projectPath) {
      projectPaths = [normalizeProjectPath(item.projectPath)];
    }
  }

  return { global, projectPaths };
}

export function migrateInstallation(raw: unknown): Installation {
  const item = raw as LegacyInstallation;
  return normalizeInstallation({
    id: item.id,
    repoId: item.repoId,
    kind: item.kind,
    artifactId: item.artifactId,
    sourcePath: item.sourcePath,
    targetName: item.targetName,
    scopes: scopesFromLegacy(item),
  });
}

export function normalizeProjectPath(projectPath: string): string {
  return path.resolve(projectPath);
}

export function normalizeProjectPaths(projectPaths: string[]): string[] {
  return [...new Set(projectPaths.map(normalizeProjectPath))];
}

export function emptyScopes(): InstallationScopes {
  return { global: false, projectPaths: [] };
}

export function normalizeInstallationScopes(
  scopes: InstallationScopes,
): InstallationScopes {
  return {
    global: scopes.global,
    projectPaths: normalizeProjectPaths(scopes.projectPaths),
  };
}

export function normalizeInstallation(installation: Installation): Installation {
  return {
    ...installation,
    scopes: normalizeInstallationScopes(installation.scopes),
  };
}

export function findRemovedProjectPaths(
  previous: Installation,
  next: Installation,
): string[] {
  const nextSet = new Set(
    normalizeProjectPaths(next.scopes.projectPaths),
  );
  return normalizeProjectPaths(previous.scopes.projectPaths).filter(
    (p) => !nextSet.has(p),
  );
}

export function findAddedProjectPaths(
  previous: Installation,
  next: Installation,
): string[] {
  const prevSet = new Set(
    normalizeProjectPaths(previous.scopes.projectPaths),
  );
  return normalizeProjectPaths(next.scopes.projectPaths).filter(
    (p) => !prevSet.has(p),
  );
}

export function projectTargetRef(
  installation: Pick<Installation, "kind" | "targetName">,
  projectPath: string,
): { kind: Installation["kind"]; targetName: string; projectPath: string } {
  return {
    kind: installation.kind,
    targetName: installation.targetName,
    projectPath: normalizeProjectPath(projectPath),
  };
}
