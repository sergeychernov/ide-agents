export type ArtifactKind = "skill" | "agent";
export type ArtifactAllowedScope = "global" | "project" | "any";
export type AdapterId = "cursor";

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
  adapter: AdapterId;
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

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  sourcePath: string;
  name: string;
  description: string;
  hasSkillMd?: boolean;
  allowedScope: ArtifactAllowedScope | null;
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
}

export interface ApplyResultItem {
  path: string;
  action: "created" | "removed" | "skipped";
  error?: string;
}

export interface ApplyResult {
  results: ApplyResultItem[];
}

export const PACKAGE_VERSION = "0.1.0";

/** @deprecated legacy config field */
export type Scope = "global" | "project" | "off";
