import { describe, expect, it } from "vitest";
import type { Artifact, Installation } from "../api/client";
import {
  applyAgentInstallDependencies,
  applyPatchesToRows,
  artifactRowKey,
  buildAgentScopeOffPatches,
  deletableDependentSkillsForAgentInScope,
  findInstallation,
  type ArtifactRow,
} from "./artifactRow";

const REPO = "writing-kit";
const PROJECT = "/Users/me/code/articles";

function artifact(
  kind: Artifact["kind"],
  id: string,
  extra: Partial<Artifact> = {},
): Artifact {
  return {
    id,
    kind,
    sourcePath: kind === "skill" ? `skills/${id}` : `agents/${id}.md`,
    name: id,
    description: "",
    allowedScope: "any",
    ...extra,
  };
}

function row(
  kind: Artifact["kind"],
  id: string,
  flags: { global?: boolean; project?: boolean; dependsOnSkills?: string[] },
): ArtifactRow {
  return {
    artifact: artifact(kind, id, {
      dependsOnSkills: flags.dependsOnSkills,
    }),
    global: flags.global ?? false,
    project: flags.project ?? false,
    projectPath: PROJECT,
    installationId: `${kind}-${id}`,
  };
}

function installation(
  kind: Installation["kind"],
  artifactId: string,
  flags: { global?: boolean; project?: boolean },
): Installation {
  return {
    id: `${kind}-inst-${artifactId}`,
    repoId: REPO,
    kind,
    artifactId,
    sourcePath: kind === "skill" ? `skills/${artifactId}` : `agents/${artifactId}.md`,
    targetName: artifactId,
    global: flags.global ?? false,
    project: flags.project ?? false,
    projectPath: PROJECT,
  };
}

describe("findInstallation", () => {
  const installations = [
    installation("skill", "article-architect", { global: true, project: true }),
    installation("agent", "article-architect", { global: false, project: true }),
  ];

  it("matches kind and artifactId separately for colliding ids", () => {
    expect(
      findInstallation(installations, REPO, {
        kind: "agent",
        id: "article-architect",
      })?.global,
    ).toBe(false);
    expect(
      findInstallation(installations, REPO, {
        kind: "skill",
        id: "article-architect",
      })?.global,
    ).toBe(true);
  });
});

describe("deletableDependentSkillsForAgentInScope", () => {
  const rows = [
    row("skill", "article-architect", { global: true, project: true }),
    row("agent", "article-architect", {
      global: true,
      project: true,
      dependsOnSkills: ["article-architect"],
    }),
    row("agent", "oracle", {
      global: true,
      project: false,
      dependsOnSkills: ["article-architect"],
    }),
  ];

  it("lists global skill only when turning off agent global", () => {
    const agent = rows[1]!;
    const deletable = deletableDependentSkillsForAgentInScope(agent, rows, "global");
    expect(deletable.map((r) => r.artifact.id)).toEqual([]);
  });

  it("lists project skill when no other agent uses it in project scope", () => {
    const agent = rows[1]!;
    const deletable = deletableDependentSkillsForAgentInScope(
      agent,
      rows,
      "project",
    );
    expect(deletable.map((r) => r.artifact.id)).toEqual(["article-architect"]);
  });

  it("excludes skill not installed in the scope", () => {
    const onlyGlobalSkill = [
      row("skill", "article-architect", { global: true, project: false }),
      row("agent", "article-architect", {
        global: true,
        project: false,
        dependsOnSkills: ["article-architect"],
      }),
    ];
    const agent = onlyGlobalSkill[1]!;
    expect(
      deletableDependentSkillsForAgentInScope(agent, onlyGlobalSkill, "project"),
    ).toEqual([]);
    expect(
      deletableDependentSkillsForAgentInScope(agent, onlyGlobalSkill, "global"),
    ).toHaveLength(1);
  });
});

describe("buildAgentScopeOffPatches", () => {
  const agent = row("agent", "article-architect", {
    global: true,
    project: true,
    dependsOnSkills: ["article-architect"],
  });

  it("turns off only the requested scope on selected skills", () => {
    const patches = buildAgentScopeOffPatches(
      agent,
      "global",
      { global: false },
      ["article-architect"],
    );
    expect(patches[artifactRowKey(agent.artifact)]).toEqual({ global: false });
    expect(patches["skill:article-architect"]).toEqual({ global: false });
    expect(patches["skill:article-architect"]).not.toHaveProperty("project");
  });

  it("leaves skills out of patches when none selected", () => {
    const patches = buildAgentScopeOffPatches(agent, "project", { project: false }, []);
    expect(Object.keys(patches)).toEqual(["agent:article-architect"]);
  });
});

describe("applyAgentInstallDependencies", () => {
  const rows = [
    row("skill", "article-architect", { global: true, project: true }),
    row("agent", "article-architect", {
      global: true,
      project: true,
      dependsOnSkills: ["article-architect"],
    }),
  ];

  it("does not disable skill when agent global is turned off", () => {
    const next = applyAgentInstallDependencies(
      rows,
      "article-architect",
      { global: false },
      PROJECT,
    );
    const skill = next.find((r) => r.artifact.kind === "skill")!;
    const agent = next.find((r) => r.artifact.kind === "agent")!;
    expect(agent.global).toBe(false);
    expect(agent.project).toBe(true);
    expect(skill.global).toBe(true);
    expect(skill.project).toBe(true);
  });

  it("enables dependent skill global without forcing project off", () => {
    const base = [
      row("skill", "article-architect", { global: false, project: true }),
      row("agent", "article-architect", {
        global: false,
        project: true,
        dependsOnSkills: ["article-architect"],
      }),
    ];
    const next = applyAgentInstallDependencies(
      base,
      "article-architect",
      { global: true },
      PROJECT,
    );
    const skill = next.find((r) => r.artifact.kind === "skill")!;
    expect(skill.global).toBe(true);
    expect(skill.project).toBe(true);
  });
});

describe("applyPatchesToRows", () => {
  const rows = [
    row("skill", "article-architect", { global: true, project: true }),
    row("agent", "article-architect", {
      global: true,
      project: true,
      dependsOnSkills: ["article-architect"],
    }),
  ];

  it("applies agent-only patch without touching colliding skill id", () => {
    const next = applyPatchesToRows(
      rows,
      { "agent:article-architect": { global: false } },
      PROJECT,
    );
    expect(next.find((r) => r.artifact.kind === "agent")!.global).toBe(false);
    expect(next.find((r) => r.artifact.kind === "skill")!.global).toBe(true);
  });

  it("applies explicit skill scope patch from modal selection", () => {
    const next = applyPatchesToRows(
      rows,
      buildAgentScopeOffPatches(
        rows[1]!,
        "global",
        { global: false },
        ["article-architect"],
      ),
      PROJECT,
    );
    const skill = next.find((r) => r.artifact.kind === "skill")!;
    const agent = next.find((r) => r.artifact.kind === "agent")!;
    expect(agent.global).toBe(false);
    expect(skill.global).toBe(false);
    expect(skill.project).toBe(true);
  });

  it("keeps skill project when only global scope is turned off via modal", () => {
    const patches = buildAgentScopeOffPatches(
      rows[1]!,
      "global",
      { global: false },
      [],
    );
    const next = applyPatchesToRows(rows, patches, PROJECT);
    const skill = next.find((r) => r.artifact.kind === "skill")!;
    expect(skill.global).toBe(true);
    expect(skill.project).toBe(true);
  });
});
