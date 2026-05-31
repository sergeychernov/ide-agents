import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { Artifact, ArtifactAllowedScope } from "./types.js";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseAllowedScope(
  data: Record<string, unknown>,
): ArtifactAllowedScope {
  const scope = data.scope;
  if (scope === "global" || scope === "project" || scope === "any") {
    return scope;
  }
  return "any";
}

function parseAgentSkills(data: Record<string, unknown>): string[] {
  const skills = data.skills;
  if (!Array.isArray(skills)) {
    return [];
  }

  return skills
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseAgentDescription(content: string, fallbackName: string): string {
  const parsed = matter(content);
  if (typeof parsed.data.description === "string" && parsed.data.description.trim()) {
    return parsed.data.description.trim();
  }

  const body = parsed.content.trim();
  if (!body) {
    return "";
  }

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      return trimmed.replace(/^#+\s*/, "");
    }
    return trimmed;
  }

  return fallbackName;
}

interface ParsedSkillDir {
  id: string;
  name: string;
  description: string;
  hasSkillMd: boolean;
  allowedScope: ArtifactAllowedScope;
}

async function parseSkillDirectory(
  skillDir: string,
  dirName: string,
): Promise<ParsedSkillDir> {
  const skillMdPath = path.join(skillDir, "SKILL.md");
  const hasSkillMd = await pathExists(skillMdPath);

  let name = dirName;
  let description = "";
  let allowedScope: ArtifactAllowedScope = "any";

  if (hasSkillMd) {
    const raw = await readFile(skillMdPath, "utf8");
    const parsed = matter(raw);
    if (typeof parsed.data.name === "string" && parsed.data.name.trim()) {
      name = parsed.data.name.trim();
    }
    if (typeof parsed.data.description === "string") {
      description = parsed.data.description.trim();
    }
    allowedScope = parseAllowedScope(parsed.data as Record<string, unknown>);
  }

  return { id: dirName, name, description, hasSkillMd, allowedScope };
}

function toSkillArtifact(
  sourcePath: string,
  parsed: ParsedSkillDir,
): Artifact {
  return {
    id: parsed.id,
    kind: "skill",
    sourcePath,
    name: parsed.name,
    description: parsed.description,
    hasSkillMd: parsed.hasSkillMd,
    allowedScope: parsed.allowedScope,
  };
}

async function scanSkillsInDirectory(
  parentDir: string,
  sourcePathPrefix: string,
): Promise<Artifact[]> {
  if (!(await pathExists(parentDir))) {
    return [];
  }

  const entries = await readdir(parentDir, { withFileTypes: true });
  const artifacts: Artifact[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const skillDir = path.join(parentDir, entry.name);
    const skillMdPath = path.join(skillDir, "SKILL.md");
    if (!(await pathExists(skillMdPath))) {
      continue;
    }

    const parsed = await parseSkillDirectory(skillDir, entry.name);
    const relativeSource = sourcePathPrefix
      ? path.join(sourcePathPrefix, entry.name)
      : entry.name;
    artifacts.push(toSkillArtifact(relativeSource, parsed));
  }

  return artifacts.sort((a, b) => a.id.localeCompare(b.id));
}

async function scanSkillsNested(repoPath: string): Promise<Artifact[]> {
  return scanSkillsInDirectory(path.join(repoPath, "skills"), "skills");
}

/** Repos like bluriesophos/cursorskills: `<repo>/<skill-name>/SKILL.md` at root. */
async function scanSkillsFlat(repoPath: string): Promise<Artifact[]> {
  return scanSkillsInDirectory(repoPath, "");
}

async function scanSkills(repoPath: string): Promise<Artifact[]> {
  const nested = await scanSkillsNested(repoPath);
  if (nested.length > 0) {
    return nested;
  }
  return scanSkillsFlat(repoPath);
}

async function scanAgents(repoPath: string): Promise<Artifact[]> {
  const agentsDir = path.join(repoPath, "agents");
  if (!(await pathExists(agentsDir))) {
    return [];
  }

  const entries = await readdir(agentsDir, { withFileTypes: true });
  const artifacts: Artifact[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const agentPath = path.join(agentsDir, entry.name);
    const id = entry.name.replace(/\.md$/, "");
    const raw = await readFile(agentPath, "utf8");
    const parsed = matter(raw);
    const description = parseAgentDescription(raw, id);
    const allowedScope = parseAllowedScope(
      parsed.data as Record<string, unknown>,
    );

    const dependsOnSkills = parseAgentSkills(
      parsed.data as Record<string, unknown>,
    );

    artifacts.push({
      id,
      kind: "agent",
      sourcePath: path.join("agents", entry.name),
      name: id,
      description,
      allowedScope,
      ...(dependsOnSkills.length > 0 ? { dependsOnSkills } : {}),
    });
  }

  return artifacts.sort((a, b) => a.id.localeCompare(b.id));
}

function enrichSkillDependencies(artifacts: Artifact[]): Artifact[] {
  const skillsById = new Map(
    artifacts.filter((artifact) => artifact.kind === "skill").map((skill) => [
      skill.id,
      skill,
    ]),
  );

  return artifacts.map((artifact) => {
    if (artifact.kind !== "agent" || !artifact.dependsOnSkills?.length) {
      return artifact;
    }

    const skillDependencies = artifact.dependsOnSkills.map((skillId) => {
      const skill = skillsById.get(skillId);
      return {
        id: skillId,
        name: skill?.name ?? skillId,
        description: skill?.description ?? "",
      };
    });

    return { ...artifact, skillDependencies };
  });
}

export async function scanRepoArtifacts(repoPath: string): Promise<Artifact[]> {
  const [skills, agents] = await Promise.all([
    scanSkills(repoPath),
    scanAgents(repoPath),
  ]);
  return enrichSkillDependencies([...skills, ...agents]);
}
