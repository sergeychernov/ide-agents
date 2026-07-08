import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanRepo } from "./scan.js";

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "ide-agents-scan-"));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

async function writeSkill(
  relDir: string,
  frontmatter: Record<string, string> = {},
): Promise<void> {
  const dir = path.join(repoRoot, relDir);
  await mkdir(dir, { recursive: true });
  const lines = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`);
  const front = lines.length > 0 ? `---\n${lines.join("\n")}\n---\n` : "";
  await writeFile(path.join(dir, "SKILL.md"), `${front}# skill\n`, "utf8");
}

async function writeAgent(
  name: string,
  frontmatter = "",
): Promise<void> {
  const dir = path.join(repoRoot, "agents");
  await mkdir(dir, { recursive: true });
  const front = frontmatter ? `---\n${frontmatter}\n---\n` : "";
  await writeFile(path.join(dir, `${name}.md`), `${front}# ${name}\n`, "utf8");
}

async function writeSkillMarkdown(
  relDir: string,
  body: string,
): Promise<void> {
  const dir = path.join(repoRoot, relDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), body, "utf8");
}

async function writeCodexYaml(relDir: string, yaml: string): Promise<void> {
  const dir = path.join(repoRoot, relDir, "agents");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "openai.yaml"), yaml, "utf8");
}

describe("scanRepo skill layouts", () => {
  it("detects nested layout (skills/<id>/SKILL.md)", async () => {
    await writeSkill("skills/alpha", { name: "Alpha" });
    await writeSkill("skills/beta");

    const { artifacts, skillLayout } = await scanRepo(repoRoot);

    expect(skillLayout).toBe("nested");
    const skills = artifacts.filter((a) => a.kind === "skill");
    expect(skills.map((s) => s.id)).toEqual(["alpha", "beta"]);
    expect(skills[0]?.sourcePath).toBe(path.join("skills", "alpha"));
  });

  it("detects flat layout (<id>/SKILL.md at root)", async () => {
    await writeSkill("code-review");
    await writeSkill("debug-to-fix");

    const { artifacts, skillLayout } = await scanRepo(repoRoot);

    expect(skillLayout).toBe("flat");
    const skills = artifacts.filter((a) => a.kind === "skill");
    expect(skills.map((s) => s.id)).toEqual(["code-review", "debug-to-fix"]);
    expect(skills[0]?.sourcePath).toBe("code-review");
  });

  it("detects bucketed layout (skills/<bucket>/<id>/SKILL.md)", async () => {
    await writeSkill("skills/.curated/gh-fix-ci", { name: "GH Fix CI" });
    await writeSkill("skills/.system/skill-creator");

    const { artifacts, skillLayout } = await scanRepo(repoRoot);

    expect(skillLayout).toBe("bucketed");
    const skills = artifacts.filter((a) => a.kind === "skill");
    expect(skills.map((s) => s.id)).toEqual(["gh-fix-ci", "skill-creator"]);
    const ghFixCi = skills.find((s) => s.id === "gh-fix-ci");
    expect(ghFixCi?.sourcePath).toBe(
      path.join("skills", ".curated", "gh-fix-ci"),
    );
    expect(ghFixCi?.name).toBe("GH Fix CI");
  });

  it("prefers .curated over .system on id collision in bucketed layout", async () => {
    await writeSkill("skills/.curated/openai-docs", { name: "Curated Docs" });
    await writeSkill("skills/.system/openai-docs", { name: "System Docs" });

    const { artifacts } = await scanRepo(repoRoot);
    const docs = artifacts.filter(
      (a) => a.kind === "skill" && a.id === "openai-docs",
    );

    expect(docs).toHaveLength(1);
    expect(docs[0]?.name).toBe("Curated Docs");
    expect(docs[0]?.sourcePath).toBe(
      path.join("skills", ".curated", "openai-docs"),
    );
  });

  it("prefers nested over bucketed when both are present", async () => {
    await writeSkill("skills/direct-skill");
    await writeSkill("skills/.curated/bucketed-skill");

    const { artifacts, skillLayout } = await scanRepo(repoRoot);

    expect(skillLayout).toBe("nested");
    const skills = artifacts.filter((a) => a.kind === "skill");
    expect(skills.map((s) => s.id)).toEqual(["direct-skill"]);
  });

  it("returns empty layout when no skills exist", async () => {
    const { artifacts, skillLayout } = await scanRepo(repoRoot);
    expect(skillLayout).toBe("empty");
    expect(artifacts.filter((a) => a.kind === "skill")).toHaveLength(0);
  });

  it("scans agents independently of skill layout", async () => {
    await writeSkill("skills/.curated/foo");
    await writeAgent("my-agent", "description: An agent");

    const { artifacts, skillLayout } = await scanRepo(repoRoot);

    expect(skillLayout).toBe("bucketed");
    const agent = artifacts.find((a) => a.kind === "agent");
    expect(agent?.id).toBe("my-agent");
    expect(agent?.sourcePath).toBe(path.join("agents", "my-agent.md"));
  });

  it("parses agent subagents and resolves subagentDependencies", async () => {
    await writeAgent("article-notes", "description: Notes agent");
    await writeAgent(
      "article-assistant",
      [
        "description: Router agent",
        "skills:",
        "  - article-assistant",
        "subagents:",
        "  - article-notes",
      ].join("\n"),
    );

    const { artifacts } = await scanRepo(repoRoot);
    const router = artifacts.find((a) => a.id === "article-assistant");
    expect(router?.dependsOnSubagents).toEqual(["article-notes"]);
    expect(router?.subagentDependencies).toEqual([
      {
        id: "article-notes",
        name: "article-notes",
        description: "Notes agent",
      },
    ]);
  });

  it("tags bucketed skills with their bucket and leaves nested skills untagged", async () => {
    await writeSkill("skills/.curated/foo");
    const { artifacts } = await scanRepo(repoRoot);
    expect(artifacts.find((a) => a.id === "foo")?.bucket).toBe(".curated");

    const nestedRoot = await mkdtemp(path.join(tmpdir(), "ide-agents-nested-"));
    try {
      await mkdir(path.join(nestedRoot, "skills", "bar"), { recursive: true });
      await writeFile(
        path.join(nestedRoot, "skills", "bar", "SKILL.md"),
        "# skill\n",
        "utf8",
      );
      const nested = await scanRepo(nestedRoot);
      expect(nested.artifacts.find((a) => a.id === "bar")?.bucket).toBeUndefined();
    } finally {
      await rm(nestedRoot, { recursive: true, force: true });
    }
  });
});

describe("scanRepo codex metadata", () => {
  it("parses agents/openai.yaml into codexMeta", async () => {
    await writeSkill("skills/.curated/gh-fix-ci", { name: "gh-fix-ci" });
    await writeCodexYaml(
      "skills/.curated/gh-fix-ci",
      [
        "interface:",
        '  display_name: "GitHub Fix CI"',
        '  short_description: "Fix a failing CI run"',
        '  icon_large: "./assets/gh.png"',
        '  default_prompt: "Fix the failing CI for this branch."',
        "policy:",
        "  allow_implicit_invocation: true",
      ].join("\n"),
    );

    const { artifacts } = await scanRepo(repoRoot);
    const meta = artifacts.find((a) => a.id === "gh-fix-ci")?.codexMeta;

    expect(meta).toEqual({
      displayName: "GitHub Fix CI",
      shortDescription: "Fix a failing CI run",
      defaultPrompt: "Fix the failing CI for this branch.",
      iconPath: "./assets/gh.png",
    });
  });

  it("leaves codexMeta undefined when openai.yaml is absent", async () => {
    await writeSkill("skills/plain", { name: "Plain" });
    const { artifacts } = await scanRepo(repoRoot);
    expect(artifacts.find((a) => a.id === "plain")?.codexMeta).toBeUndefined();
  });

  it("falls back to metadata.short-description for the skill description", async () => {
    await writeSkillMarkdown(
      "skills/docs",
      [
        "---",
        "name: docs",
        "metadata:",
        "  short-description: Short desc from metadata",
        "---",
        "# docs",
      ].join("\n"),
    );

    const { artifacts } = await scanRepo(repoRoot);
    expect(artifacts.find((a) => a.id === "docs")?.description).toBe(
      "Short desc from metadata",
    );
  });
});
