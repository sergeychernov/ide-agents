/**
 * Shared API/DTO types — the single source of truth for the wire contract
 * between the backend (`src/`) and the web client (`web/src/`).
 *
 * Keep this file type-only: no runtime code, no Node or DOM imports. It is
 * compiled by the backend (NodeNext) and consumed by the web build via the
 * `@shared/*` path alias using `import type` (erased at runtime).
 */

export type ArtifactKind = "skill" | "agent";
export type ArtifactAllowedScope = "global" | "project" | "any";

/**
 * Detected repository skill layout:
 * - `nested`: `skills/<id>/SKILL.md`
 * - `flat`: `<id>/SKILL.md` at repo root
 * - `bucketed`: `skills/<bucket>/<id>/SKILL.md` (e.g. openai/skills `.curated`, `.system`)
 * - `empty`: no skills found
 */
export type SkillLayout = "nested" | "flat" | "bucketed" | "empty";

export type IdeId = "cursor" | "claude" | "codex" | "opencode";

export interface IdeToolConfig {
  enabled: boolean;
  configPath: string;
}

export interface IdesConfig {
  cursor: IdeToolConfig;
  claude: IdeToolConfig;
  codex: IdeToolConfig;
  opencode: IdeToolConfig;
}

export interface NpmUpdateInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  installCommand: string;
}

export interface GitStatus {
  branch: string | null;
  sha: string | null;
  dirty: boolean;
  behind: number | null;
  ahead: number | null;
  error?: string;
}

export interface TargetStatus {
  exists: boolean;
  isSymlink: boolean;
  blocked: boolean;
}

export interface ArtifactTargets {
  global: TargetStatus;
  project: TargetStatus | null;
}

export interface SkillDependency {
  id: string;
  name: string;
  description: string;
}

/**
 * Codex plugin metadata parsed from a skill's `agents/openai.yaml` (openai/skills
 * layout). This is presentation metadata for the skill, not an ide-agents agent.
 */
export interface CodexSkillMeta {
  displayName?: string;
  shortDescription?: string;
  defaultPrompt?: string;
  /** Icon path relative to the skill directory (e.g. `./assets/icon.png`). */
  iconPath?: string;
}

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  sourcePath: string;
  name: string;
  description: string;
  hasSkillMd?: boolean;
  allowedScope: ArtifactAllowedScope | null;
  dependsOnSkills?: string[];
  skillDependencies?: SkillDependency[];
  /** Other agent ids this agent delegates to (router agents), from frontmatter. */
  dependsOnSubagents?: string[];
  /** Resolved `dependsOnSubagents` with names/descriptions, for UI display. */
  subagentDependencies?: SkillDependency[];
  targets?: ArtifactTargets;
  /** Top-level bucket for bucketed layouts (e.g. `.curated`, `.system`). */
  bucket?: string;
  /** Codex plugin metadata from `agents/openai.yaml`, when present. */
  codexMeta?: CodexSkillMeta;
}

export interface Installation {
  id: string;
  repoId: string;
  kind: ArtifactKind;
  artifactId: string;
  sourcePath: string;
  targetName: string;
  global: boolean;
  project: boolean;
  projectPath: string | null;
}

/** Result of bootstrapping an empty repo with the starter template. */
export interface RepoBootstrap {
  applied: boolean;
  pushed: boolean;
  pushError?: string;
  skillCount: number;
  agentCount: number;
  skillLayout: SkillLayout;
}

/** A configured repository enriched with git status and scan results. */
export interface RepoWithStatus {
  id: string;
  url: string;
  ref: string;
  slug: string;
  localPath: string;
  git: GitStatus;
  skillCount: number;
  agentCount: number;
  skillLayout: SkillLayout;
}

export interface ApplyResultItem {
  path: string;
  action: "created" | "removed" | "skipped";
  error?: string;
}
