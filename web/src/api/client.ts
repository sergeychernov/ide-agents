export type ArtifactKind = "skill" | "agent";
export type ArtifactAllowedScope = "global" | "project" | "any";

export interface GitStatus {
  branch: string | null;
  sha: string | null;
  dirty: boolean;
  behind: number | null;
  ahead: number | null;
  error?: string;
}

export interface Repo {
  id: string;
  url: string;
  ref: string;
  slug: string;
  localPath: string;
  git: GitStatus;
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

export interface ApplyResultItem {
  path: string;
  action: "created" | "removed" | "skipped";
  error?: string;
}

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
      adapter: string;
      port: number;
      version: string;
      defaultProjectPath: string | null;
    }>("/api/status"),

  repos: () => request<{ repos: Repo[] }>("/api/repos"),

  addRepo: (url: string, ref: string) =>
    request<{ repo: Repo }>("/api/repos", {
      method: "POST",
      body: JSON.stringify({ url, ref }),
    }),

  deleteRepo: (id: string) =>
    request<{ ok: boolean }>(`/api/repos/${id}`, { method: "DELETE" }),

  fetchRepo: (id: string) =>
    request<{ git: GitStatus }>(`/api/repos/${id}/fetch`, { method: "POST" }),

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
