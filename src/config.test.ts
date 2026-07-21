import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  findAddedProjectPaths,
  findRemovedProjectPaths,
  migrateInstallation,
} from "./install-scopes.js";
import type { Installation } from "./types.js";

function inst(scopes: Installation["scopes"]): Installation {
  return {
    id: "1",
    repoId: "repo",
    kind: "skill",
    artifactId: "demo",
    sourcePath: "skills/demo",
    targetName: "demo",
    scopes,
  };
}

describe("migrateInstallation", () => {
  it("maps legacy project install to scopes.projectPaths", () => {
    const migrated = migrateInstallation({
      id: "1",
      repoId: "repo",
      kind: "skill",
      artifactId: "demo",
      sourcePath: "skills/demo",
      targetName: "demo",
      global: false,
      project: true,
      projectPath: "/code/auth",
    });

    expect(migrated.scopes).toEqual({
      global: false,
      projectPaths: [path.resolve("/code/auth")],
    });
  });

  it("drops stale projectPath when legacy project is off", () => {
    const migrated = migrateInstallation({
      id: "1",
      repoId: "repo",
      kind: "skill",
      artifactId: "demo",
      sourcePath: "skills/demo",
      targetName: "demo",
      global: true,
      project: false,
      projectPath: "/code/auth",
    });

    expect(migrated.scopes).toEqual({
      global: true,
      projectPaths: [],
    });
  });
});

describe("project path diff helpers", () => {
  it("finds removed and added project paths", () => {
    const prev = inst({ global: false, projectPaths: ["/code/a", "/code/b"] });
    const next = inst({ global: false, projectPaths: ["/code/b", "/code/c"] });

    expect(findRemovedProjectPaths(prev, next)).toEqual(["/code/a"]);
    expect(findAddedProjectPaths(prev, next)).toEqual(["/code/c"]);
  });
});
