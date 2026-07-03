import type {
  ApplyResultItem,
  IdeId,
  IdesConfig,
  Installation,
} from "./shared/api-types.js";

export type {
  ApplyResultItem,
  Artifact,
  ArtifactAllowedScope,
  ArtifactKind,
  ArtifactTargets,
  CodexSkillMeta,
  GitStatus,
  IdeId,
  IdeToolConfig,
  IdesConfig,
  Installation,
  NpmUpdateInfo,
  RepoBootstrap,
  RepoWithStatus,
  SkillDependency,
  SkillLayout,
  TargetStatus,
} from "./shared/api-types.js";

/** @deprecated use IdeId */
export type AdapterId = IdeId;

export interface ServerConfig {
  port: number;
}

export interface RepoConfig {
  id: string;
  url: string;
  ref: string;
  slug: string;
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

export interface ApplyResult {
  results: ApplyResultItem[];
}

/** @deprecated legacy config field */
export type Scope = "global" | "project" | "off";
