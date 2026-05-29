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
): ArtifactAllowedScope | null {
  const scope = data.scope;
  if (scope === "global" || scope === "project" || scope === "any") {
    return scope;
  }
  return null;
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

async function scanSkills(repoPath: string): Promise<Artifact[]> {
  const skillsDir = path.join(repoPath, "skills");
  if (!(await pathExists(skillsDir))) {
    return [];
  }

  const entries = await readdir(skillsDir, { withFileTypes: true });
  const artifacts: Artifact[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(skillsDir, entry.name);
    const skillMdPath = path.join(skillDir, "SKILL.md");
    const hasSkillMd = await pathExists(skillMdPath);

    let name = entry.name;
    let description = "";
    let allowedScope: ArtifactAllowedScope | null = null;

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

    artifacts.push({
      id: entry.name,
      kind: "skill",
      sourcePath: path.join("skills", entry.name),
      name,
      description,
      hasSkillMd,
      allowedScope,
    });
  }

  return artifacts.sort((a, b) => a.id.localeCompare(b.id));
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

    artifacts.push({
      id,
      kind: "agent",
      sourcePath: path.join("agents", entry.name),
      name: id,
      description,
      allowedScope,
    });
  }

  return artifacts.sort((a, b) => a.id.localeCompare(b.id));
}

export async function scanRepoArtifacts(repoPath: string): Promise<Artifact[]> {
  const [skills, agents] = await Promise.all([
    scanSkills(repoPath),
    scanAgents(repoPath),
  ]);
  return [...skills, ...agents];
}
