import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import type {
  Artifact,
  ArtifactAllowedScope,
  CodexSkillMeta,
  SkillLayout,
} from "./types.js";

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

function parseAgentSubagents(data: Record<string, unknown>): string[] {
  const subagents = data.subagents;
  if (!Array.isArray(subagents)) {
    return [];
  }

  return subagents
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

/** Read `metadata.short-description` from SKILL.md frontmatter, if present. */
function parseMetadataShortDescription(
  data: Record<string, unknown>,
): string | undefined {
  const metadata = data.metadata;
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const value = (metadata as Record<string, unknown>)["short-description"];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Parse Codex plugin metadata from a skill's `agents/openai.yaml`. Returns
 * undefined when the file is missing, unparseable, or has no useful fields.
 */
async function parseCodexSkillMeta(
  skillDir: string,
): Promise<CodexSkillMeta | undefined> {
  const yamlPath = path.join(skillDir, "agents", "openai.yaml");
  if (!(await pathExists(yamlPath))) {
    return undefined;
  }

  let doc: unknown;
  try {
    doc = parseYaml(await readFile(yamlPath, "utf8"));
  } catch {
    return undefined;
  }

  if (!doc || typeof doc !== "object") {
    return undefined;
  }

  const iface = (doc as Record<string, unknown>).interface;
  if (!iface || typeof iface !== "object") {
    return undefined;
  }

  const record = iface as Record<string, unknown>;
  const meta: CodexSkillMeta = {};
  const displayName = optionalString(record.display_name);
  const shortDescription = optionalString(record.short_description);
  const defaultPrompt = optionalString(record.default_prompt);
  const iconPath =
    optionalString(record.icon_large) ?? optionalString(record.icon_small);

  if (displayName) meta.displayName = displayName;
  if (shortDescription) meta.shortDescription = shortDescription;
  if (defaultPrompt) meta.defaultPrompt = defaultPrompt;
  if (iconPath) meta.iconPath = iconPath;

  return Object.keys(meta).length > 0 ? meta : undefined;
}

interface ParsedSkillDir {
  id: string;
  name: string;
  description: string;
  hasSkillMd: boolean;
  allowedScope: ArtifactAllowedScope;
  codexMeta?: CodexSkillMeta;
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
    const data = parsed.data as Record<string, unknown>;
    if (typeof data.name === "string" && data.name.trim()) {
      name = data.name.trim();
    }
    if (typeof data.description === "string") {
      description = data.description.trim();
    }
    if (!description) {
      description = parseMetadataShortDescription(data) ?? "";
    }
    allowedScope = parseAllowedScope(data);
  }

  const codexMeta = await parseCodexSkillMeta(skillDir);

  return { id: dirName, name, description, hasSkillMd, allowedScope, codexMeta };
}

function toSkillArtifact(
  sourcePath: string,
  parsed: ParsedSkillDir,
  bucket?: string,
): Artifact {
  return {
    id: parsed.id,
    kind: "skill",
    sourcePath,
    name: parsed.name,
    description: parsed.description,
    hasSkillMd: parsed.hasSkillMd,
    allowedScope: parsed.allowedScope,
    ...(bucket ? { bucket } : {}),
    ...(parsed.codexMeta ? { codexMeta: parsed.codexMeta } : {}),
  };
}

async function scanSkillsInDirectory(
  parentDir: string,
  sourcePathPrefix: string,
  bucket?: string,
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
    artifacts.push(toSkillArtifact(relativeSource, parsed, bucket));
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

/**
 * Bucket priority for id-collision resolution (lower rank wins). Repos like
 * openai/skills group skills under `skills/.curated`, `skills/.system`, etc.
 */
const BUCKET_RANK: Record<string, number> = {
  ".curated": 0,
  ".experimental": 1,
  ".system": 3,
};

function bucketRank(name: string): number {
  return BUCKET_RANK[name] ?? 2;
}

/**
 * Repos like openai/skills: `skills/<bucket>/<skill-name>/SKILL.md`, where
 * `<bucket>` is a top-level folder under `skills/` (often dot-prefixed, e.g.
 * `.curated`, `.system`). On id collisions across buckets the higher-priority
 * bucket wins.
 */
async function scanSkillsBucketed(repoPath: string): Promise<Artifact[]> {
  const skillsDir = path.join(repoPath, "skills");
  if (!(await pathExists(skillsDir))) {
    return [];
  }

  const entries = await readdir(skillsDir, { withFileTypes: true });
  const buckets = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => bucketRank(a) - bucketRank(b) || a.localeCompare(b));

  const byId = new Map<string, Artifact>();
  for (const bucket of buckets) {
    const found = await scanSkillsInDirectory(
      path.join(skillsDir, bucket),
      path.join("skills", bucket),
      bucket,
    );
    for (const artifact of found) {
      if (!byId.has(artifact.id)) {
        byId.set(artifact.id, artifact);
      }
    }
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

interface SkillScanResult {
  artifacts: Artifact[];
  layout: SkillLayout;
}

/**
 * Detect the repo skill layout and return the matching skills. Order matters:
 * `nested` (direct `skills/<id>`) → `bucketed` (`skills/<bucket>/<id>`) → `flat`
 * (`<id>` at root). Existing nested/flat repos keep their previous behavior.
 */
async function scanSkillsWithLayout(
  repoPath: string,
): Promise<SkillScanResult> {
  const nested = await scanSkillsNested(repoPath);
  if (nested.length > 0) {
    return { artifacts: nested, layout: "nested" };
  }

  const bucketed = await scanSkillsBucketed(repoPath);
  if (bucketed.length > 0) {
    return { artifacts: bucketed, layout: "bucketed" };
  }

  const flat = await scanSkillsFlat(repoPath);
  if (flat.length > 0) {
    return { artifacts: flat, layout: "flat" };
  }

  return { artifacts: [], layout: "empty" };
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
    const dependsOnSubagents = parseAgentSubagents(
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
      ...(dependsOnSubagents.length > 0 ? { dependsOnSubagents } : {}),
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
  const agentsById = new Map(
    artifacts.filter((artifact) => artifact.kind === "agent").map((agent) => [
      agent.id,
      agent,
    ]),
  );

  return artifacts.map((artifact) => {
    if (artifact.kind !== "agent") {
      return artifact;
    }

    let next = artifact;

    if (artifact.dependsOnSkills?.length) {
      const skillDependencies = artifact.dependsOnSkills.map((skillId) => {
        const skill = skillsById.get(skillId);
        return {
          id: skillId,
          name: skill?.name ?? skillId,
          description: skill?.description ?? "",
        };
      });
      next = { ...next, skillDependencies };
    }

    if (artifact.dependsOnSubagents?.length) {
      const subagentDependencies = artifact.dependsOnSubagents.map(
        (agentId) => {
          const agent = agentsById.get(agentId);
          return {
            id: agentId,
            name: agent?.name ?? agentId,
            description: agent?.description ?? "",
          };
        },
      );
      next = { ...next, subagentDependencies };
    }

    return next;
  });
}

export interface RepoScanResult {
  artifacts: Artifact[];
  skillLayout: SkillLayout;
}

export async function scanRepo(repoPath: string): Promise<RepoScanResult> {
  const [skills, agents] = await Promise.all([
    scanSkillsWithLayout(repoPath),
    scanAgents(repoPath),
  ]);
  return {
    artifacts: enrichSkillDependencies([...skills.artifacts, ...agents]),
    skillLayout: skills.layout,
  };
}

export async function scanRepoArtifacts(repoPath: string): Promise<Artifact[]> {
  return (await scanRepo(repoPath)).artifacts;
}
