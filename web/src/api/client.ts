import type {
  Artifact,
  ApplyResultItem,
  GitStatus,
  IdesConfig,
  Installation,
  NpmUpdateInfo,
  RepoBootstrap,
  RepoWithStatus,
} from "@shared/api-types";

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
  SkillDependency,
  SkillLayout,
  TargetStatus,
} from "@shared/api-types";

/** A configured repository enriched with git status and scan results. */
export type Repo = RepoWithStatus;

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  status: () =>
    request<{
      home: string;
      port: number;
      version: string;
      npmUpdate: NpmUpdateInfo;
      defaultProjectPath: string | null;
      ides: IdesConfig;
    }>("/api/status"),

  settings: () =>
    request<{
      ides: IdesConfig;
      defaults: IdesConfig;
      home: string;
      version: string;
      npmUpdate: NpmUpdateInfo;
    }>("/api/settings"),

  saveSettings: (ides: IdesConfig) =>
    request<{ ides: IdesConfig }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ ides }),
    }),

  repos: () => request<{ repos: Repo[] }>("/api/repos"),

  addRepo: (url: string, ref: string, id?: string) =>
    request<{ repo: Repo; bootstrap?: RepoBootstrap }>("/api/repos", {
      method: "POST",
      body: JSON.stringify({ url, ref, ...(id ? { id } : {}) }),
    }),

  deleteRepo: (id: string) =>
    request<{ ok: boolean }>(`/api/repos/${id}`, { method: "DELETE" }),

  bootstrapRepo: (id: string) =>
    request<{ repo: Repo; bootstrap: RepoBootstrap }>(
      `/api/repos/${id}/bootstrap`,
      { method: "POST" },
    ),

  fetchRepo: (id: string) =>
    request<{ git: GitStatus }>(`/api/repos/${id}/fetch`, { method: "POST" }),

  checkRepoUpdates: (id: string) =>
    request<{ git: GitStatus }>(`/api/repos/${id}/check-updates`, {
      method: "POST",
    }),

  pullRepo: (id: string) =>
    request<{ git: GitStatus }>(`/api/repos/${id}/pull`, { method: "POST" }),

  artifacts: (repoId: string, projectPath?: string) => {
    const params = projectPath
      ? `?projectPath=${encodeURIComponent(projectPath)}`
      : "";
    return request<{ artifacts: Artifact[] }>(
      `/api/repos/${repoId}/artifacts${params}`,
    );
  },

  installations: () =>
    request<{ installations: Installation[]; recentProjects: string[] }>(
      "/api/installations",
    ),

  saveInstallations: (installations: Installation[]) =>
    request<{ installations: Installation[] }>("/api/installations", {
      method: "PUT",
      body: JSON.stringify({ installations }),
    }),

  apply: () =>
    request<{ results: ApplyResultItem[] }>("/api/apply", { method: "POST" }),
};
