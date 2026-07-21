import { describe, expect, it } from "vitest";
import type { Artifact, Installation } from "../api/client";
import { buildRows, rowsToInstallations } from "./artifactListRows";

const REPO = "writing-kit";
const PATH_A = "/Users/me/code/auth";
const PATH_B = "/Users/me/code/personal-area";

function artifact(id: string): Artifact {
  return {
    id,
    kind: "skill",
    sourcePath: `skills/${id}`,
    name: id,
    description: "",
    allowedScope: "any",
  };
}

function installation(
  artifactId: string,
  scopes: Installation["scopes"],
): Installation {
  return {
    id: `inst-${artifactId}`,
    repoId: REPO,
    kind: "skill",
    artifactId,
    sourcePath: `skills/${artifactId}`,
    targetName: artifactId,
    scopes,
  };
}

describe("buildRows", () => {
  it("shows project off when installed in another project", () => {
    const rows = buildRows(
      [artifact("m2-design")],
      [installation("m2-design", { global: false, projectPaths: [PATH_A] })],
      REPO,
      PATH_B,
    );

    expect(rows[0]?.project).toBe(false);
    expect(rows[0]?.otherProjectPaths).toEqual([PATH_A]);
  });

  it("shows project on when installed in launch cwd", () => {
    const rows = buildRows(
      [artifact("m2-design")],
      [installation("m2-design", { global: false, projectPaths: [PATH_A] })],
      REPO,
      PATH_A,
    );

    expect(rows[0]?.project).toBe(true);
    expect(rows[0]?.otherProjectPaths).toEqual([]);
  });
});

describe("rowsToInstallations", () => {
  const existing = [
    installation("m2-design", { global: false, projectPaths: [PATH_A] }),
  ];

  it("preserves other project paths when viewing from unrelated cwd", () => {
    const rows = buildRows(
      [artifact("m2-design")],
      existing,
      REPO,
      PATH_B,
    );

    const next = rowsToInstallations(rows, REPO, existing, PATH_B);
    expect(next[0]?.scopes.projectPaths).toEqual([PATH_A]);
  });

  it("adds launch cwd without removing existing project paths", () => {
    const rows = buildRows(
      [artifact("m2-design")],
      existing,
      REPO,
      PATH_B,
    );
    const toggled = rows.map((row) => ({ ...row, project: true }));

    const next = rowsToInstallations(toggled, REPO, existing, PATH_B);
    expect(next[0]?.scopes.projectPaths).toEqual([PATH_A, PATH_B]);
  });

  it("removes only launch cwd on project toggle off", () => {
    const both = [
      installation("m2-design", {
        global: false,
        projectPaths: [PATH_A, PATH_B],
      }),
    ];
    const rows = buildRows([artifact("m2-design")], both, REPO, PATH_B);
    const toggled = rows.map((row) => ({ ...row, project: false }));

    const next = rowsToInstallations(toggled, REPO, both, PATH_B);
    expect(next[0]?.scopes.projectPaths).toEqual([PATH_A]);
  });
});
