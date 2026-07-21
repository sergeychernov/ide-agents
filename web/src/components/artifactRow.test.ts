import { describe, expect, it } from "vitest";
import type { Artifact, Installation } from "../api/client";
import {
  applyAgentInstallDependencies,
  applyPatchesToRows,
  artifactRowKey,
  buildAgentScopeOffPatches,
  deletableDependentSkillsForAgentInScope,
  deletableDependentSubagentsForAgentInScope,
  findInstallation,
  installedAgentsUsingSubagentInScope,
  isGlobalDisabled,
  subagentDeletableSkillsInScope,
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
  flags: {
    global?: boolean;
    project?: boolean;
    dependsOnSkills?: string[];
    dependsOnSubagents?: string[];
  },
): ArtifactRow {
  return {
    artifact: artifact(kind, id, {
      dependsOnSkills: flags.dependsOnSkills,
      dependsOnSubagents: flags.dependsOnSubagents,
    }),
    global: flags.global ?? false,
    project: flags.project ?? false,
    projectPath: PROJECT,
    otherProjectPaths: [],
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
    scopes: {
      global: flags.global ?? false,
      projectPaths: flags.project ? [PROJECT] : [],
    },
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
      })?.scopes.global,
    ).toBe(false);
    expect(
      findInstallation(installations, REPO, {
        kind: "skill",
        id: "article-architect",
      })?.scopes.global,
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

describe("subagents — install propagation", () => {
  it("enables a declared subagent when the router is enabled", () => {
    const base = [
      row("skill", "article-scaffold", { global: false, project: false }),
      row("agent", "article-scaffold", {
        global: false,
        project: false,
        dependsOnSkills: ["article-scaffold"],
      }),
      row("agent", "article-assistant", {
        global: false,
        project: false,
        dependsOnSkills: ["article-scaffold"],
        dependsOnSubagents: ["article-scaffold"],
      }),
    ];
    const next = applyAgentInstallDependencies(
      base,
      "article-assistant",
      { global: true },
      PROJECT,
    );
    const sub = next.find((r) => r.artifact.id === "article-scaffold" && r.artifact.kind === "agent")!;
    const skill = next.find((r) => r.artifact.kind === "skill")!;
    expect(sub.global).toBe(true);
    expect(skill.global).toBe(true);
  });

  it("enables nested subagents transitively without cycles", () => {
    const base = [
      row("agent", "leaf", { global: false, project: false }),
      row("agent", "mid", {
        global: false,
        project: false,
        dependsOnSubagents: ["leaf"],
      }),
      row("agent", "router", {
        global: false,
        project: false,
        dependsOnSubagents: ["mid"],
      }),
    ];
    const next = applyAgentInstallDependencies(
      base,
      "router",
      { global: true },
      PROJECT,
    );
    expect(
      next.find((r) => r.artifact.id === "mid")!.global,
    ).toBe(true);
    expect(
      next.find((r) => r.artifact.id === "leaf")!.global,
    ).toBe(true);
  });
});

describe("subagents — removal guard", () => {
  it("blocks turning off a subagent while the router is installed", () => {
    const rows = [
      row("agent", "article-scaffold", { global: true, project: false }),
      row("agent", "article-assistant", {
        global: true,
        project: false,
        dependsOnSubagents: ["article-scaffold"],
      }),
    ];
    const sub = rows[0]!;
    expect(isGlobalDisabled(sub, rows)).toBe(true);
    expect(installedAgentsUsingSubagentInScope("article-scaffold", rows, "global")).toHaveLength(1);
  });

  it("lists deletable subagent when no other router uses it", () => {
    const rows = [
      row("agent", "article-scaffold", { global: true, project: true }),
      row("agent", "article-assistant", {
        global: true,
        project: true,
        dependsOnSubagents: ["article-scaffold"],
      }),
    ];
    const router = rows[1]!;
    expect(
      deletableDependentSubagentsForAgentInScope(router, rows, "global").map(
        (r) => r.artifact.id,
      ),
    ).toEqual(["article-scaffold"]);
  });

  it("buildAgentScopeOffPatches turns off selected subagents", () => {
    const router = row("agent", "article-assistant", {
      global: true,
      project: true,
      dependsOnSubagents: ["article-scaffold"],
    });
    const patches = buildAgentScopeOffPatches(
      router,
      "global",
      { global: false },
      [],
      ["article-scaffold"],
    );
    expect(patches["agent:article-scaffold"]).toEqual({ global: false });
  });
});

describe("subagents — transitive skill removal", () => {
  it("lists a subagent's uniquely-used skill for removal", () => {
    const rows = [
      row("skill", "article-scaffold", { global: true, project: false }),
      row("agent", "article-scaffold", {
        global: true,
        project: false,
        dependsOnSkills: ["article-scaffold"],
      }),
      row("agent", "article-assistant", {
        global: true,
        project: false,
        dependsOnSubagents: ["article-scaffold"],
      }),
    ];
    const router = rows[2]!;
    expect(
      subagentDeletableSkillsInScope(
        router,
        "article-scaffold",
        ["article-scaffold"],
        rows,
        "global",
      ).map((r) => r.artifact.id),
    ).toEqual(["article-scaffold"]);
  });

  it("keeps a subagent skill when another non-removed agent uses it", () => {
    const rows = [
      row("skill", "article-scaffold", { global: true, project: false }),
      row("agent", "article-scaffold", {
        global: true,
        project: false,
        dependsOnSkills: ["article-scaffold"],
      }),
      row("agent", "article-assistant", {
        global: true,
        project: false,
        dependsOnSubagents: ["article-scaffold"],
      }),
      row("agent", "oracle", {
        global: true,
        project: false,
        dependsOnSkills: ["article-scaffold"],
      }),
    ];
    const router = rows[2]!;
    expect(
      subagentDeletableSkillsInScope(
        router,
        "article-scaffold",
        ["article-scaffold"],
        rows,
        "global",
      ),
    ).toEqual([]);
  });

  it("allows a shared skill when the other user is a sibling subagent also being removed", () => {
    const rows = [
      row("skill", "shared", { global: true, project: false }),
      row("agent", "sub-a", {
        global: true,
        project: false,
        dependsOnSkills: ["shared"],
      }),
      row("agent", "sub-b", {
        global: true,
        project: false,
        dependsOnSkills: ["shared"],
      }),
      row("agent", "router", {
        global: true,
        project: false,
        dependsOnSubagents: ["sub-a", "sub-b"],
      }),
    ];
    const router = rows[3]!;
    expect(
      subagentDeletableSkillsInScope(
        router,
        "sub-a",
        ["sub-a", "sub-b"],
        rows,
        "global",
      ).map((r) => r.artifact.id),
    ).toEqual(["shared"]);
  });

  it("skips router-owned skills (controlled by their own checkbox)", () => {
    const rows = [
      row("skill", "shared", { global: true, project: false }),
      row("agent", "article-scaffold", {
        global: true,
        project: false,
        dependsOnSkills: ["shared"],
      }),
      row("agent", "article-assistant", {
        global: true,
        project: false,
        dependsOnSkills: ["shared"],
        dependsOnSubagents: ["article-scaffold"],
      }),
    ];
    const router = rows[2]!;
    expect(
      subagentDeletableSkillsInScope(
        router,
        "article-scaffold",
        ["article-scaffold"],
        rows,
        "global",
      ),
    ).toEqual([]);
  });

  it("turns off a selected subagent skill via patches, keeping the other scope", () => {
    const rows = [
      row("skill", "article-scaffold", { global: true, project: true }),
      row("agent", "article-scaffold", {
        global: true,
        project: true,
        dependsOnSkills: ["article-scaffold"],
      }),
      row("agent", "article-assistant", {
        global: true,
        project: true,
        dependsOnSubagents: ["article-scaffold"],
      }),
    ];
    const router = rows[2]!;
    const subSkillIds = subagentDeletableSkillsInScope(
      router,
      "article-scaffold",
      ["article-scaffold"],
      rows,
      "global",
    ).map((r) => r.artifact.id);
    const patches = buildAgentScopeOffPatches(
      router,
      "global",
      { global: false },
      subSkillIds,
      ["article-scaffold"],
    );
    expect(patches["agent:article-assistant"]).toEqual({ global: false });
    expect(patches["agent:article-scaffold"]).toEqual({ global: false });
    expect(patches["skill:article-scaffold"]).toEqual({ global: false });

    const next = applyPatchesToRows(rows, patches, PROJECT);
    expect(
      next.find(
        (r) => r.artifact.id === "article-scaffold" && r.artifact.kind === "skill",
      )!.global,
    ).toBe(false);
    expect(
      next.find(
        (r) => r.artifact.id === "article-scaffold" && r.artifact.kind === "skill",
      )!.project,
    ).toBe(true);
  });
});
