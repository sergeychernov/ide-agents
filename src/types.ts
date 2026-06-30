export type ArtifactKind = "skill" | "agent";
export type ArtifactAllowedScope = "global" | "project" | "any";
export type IdeId = "cursor" | "claude" | "codex" | "opencode";
/** @deprecated use IdeId */
export type AdapterId = IdeId;

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

export interface ServerConfig {
  port: number;
}

export interface RepoConfig {
  id: string;
  url: string;
  ref: string;
  slug: string;
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

export interface IdeAgentsConfig {
  version: 1;
  /** @deprecated kept for migration; use ides */
  adapter: AdapterId;
  ides: IdesConfig;
  server: ServerConfig;
  repos: RepoConfig[];
  installations: Installation[];
  recentProjects: string[];
}

/** @deprecated renamed to IdeAgentsConfig */
export type AgentDeskConfig = IdeAgentsConfig;

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
  targets?: ArtifactTargets;
}

export interface GitStatus {
  branch: string | null;
  sha: string | null;
  dirty: boolean;
  behind: number | null;
  ahead: number | null;
  error?: string;
}

export interface RepoWithStatus extends RepoConfig {
  localPath: string;
  git: GitStatus;
  skillCount: number;
  agentCount: number;
}

export interface ApplyResultItem {
  path: string;
  action: "created" | "removed" | "skipped";
  error?: string;
}

export interface ApplyResult {
  results: ApplyResultItem[];
}

/** @deprecated legacy config field */
export type Scope = "global" | "project" | "off";
