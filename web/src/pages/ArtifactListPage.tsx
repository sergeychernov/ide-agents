import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Select, Stack, Text, Title } from "@mantine/core";
import {
  api,
  type ArtifactKind,
  type Artifact,
  type Installation,
  type Repo,
} from "../api/client";
import ArtifactCard from "../components/ArtifactCard";
import ArtifactCardGrid from "../components/ArtifactCardGrid";
import type { ArtifactRow } from "../components/artifactRow";
import {
  isGlobalDisabled,
  isProjectDisabled,
} from "../components/artifactRow";

interface ArtifactListPageProps {
  kind: ArtifactKind;
  title: string;
  emptyHint: string;
}

function buildRows(
  artifacts: Artifact[],
  installations: Installation[],
  repoId: string,
  defaultProjectPath: string,
): ArtifactRow[] {
  return artifacts.map((artifact) => {
    const existing = installations.find(
      (i) => i.repoId === repoId && i.artifactId === artifact.id,
    );
    const projectPath =
      existing?.project && existing.projectPath
        ? existing.projectPath
        : defaultProjectPath;

    return {
      artifact,
      global: existing?.global ?? false,
      project: existing?.project ?? false,
      projectPath,
      installationId: existing?.id ?? null,
    };
  });
}

function rowsToInstallations(
  rows: ArtifactRow[],
  repoId: string,
  existing: Installation[],
): Installation[] {
  const other = existing.filter((i) => i.repoId !== repoId);
  const previous = existing.filter((i) => i.repoId === repoId);
  const current: Installation[] = [];

  for (const row of rows) {
    const prev = previous.find((i) => i.artifactId === row.artifact.id);
    // Keep path when project is off so /api/apply can remove the project symlink.
    const projectPath = row.projectPath.trim() || prev?.projectPath || null;

    current.push({
      id: row.installationId ?? crypto.randomUUID(),
      repoId,
      kind: row.artifact.kind,
      artifactId: row.artifact.id,
      sourcePath: row.artifact.sourcePath,
      targetName: row.artifact.id,
      global: row.global,
      project: row.project,
      projectPath,
    });
  }

  return [...other, ...current];
}

export default function ArtifactListPage({
  kind,
  title,
  emptyHint,
}: ArtifactListPageProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoId, setRepoId] = useState<string>("");
  const [rows, setRows] = useState<ArtifactRow[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaultProjectPath, setDefaultProjectPath] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  const visibleRows = useMemo(
    () => rows.filter((row) => row.artifact.kind === kind),
    [rows, kind],
  );

  const loadBase = useCallback(async () => {
    const [reposData, instData] = await Promise.all([
      api.repos(),
      api.installations(),
    ]);
    setRepos(reposData.repos);
    setInstallations(instData.installations);
    setRecentProjects(instData.recentProjects);
    if (reposData.repos.length > 0) {
      setRepoId((prev) => prev || reposData.repos[0]!.id);
    }
  }, []);

  const loadArtifacts = useCallback(
    async (id: string, inst: Installation[], projectPath: string) => {
      const { artifacts: list } = await api.artifacts(
        id,
        projectPath || undefined,
      );
      setRows(buildRows(list, inst, id, projectPath));
    },
    [],
  );

  useEffect(() => {
    Promise.all([loadBase(), api.status()])
      .then(([, status]) => {
        setDefaultProjectPath(status.defaultProjectPath ?? "");
        setSessionReady(true);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, [loadBase]);

  useEffect(() => {
    if (!repoId || !sessionReady) return;

    const activeProjectPath = installations.find(
      (i) => i.repoId === repoId && i.project && i.projectPath,
    )?.projectPath;
    const projectPath = defaultProjectPath || activeProjectPath || "";

    loadArtifacts(repoId, installations, projectPath).catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on repo/installations/default path, not row edits
  }, [repoId, installations, defaultProjectPath, sessionReady, loadArtifacts]);

  const projectSuggestions = useMemo(() => {
    const paths = recentProjects.filter(Boolean);
    if (defaultProjectPath && !paths.includes(defaultProjectPath)) {
      return [defaultProjectPath, ...paths];
    }
    return paths;
  }, [recentProjects, defaultProjectPath]);

  const persistAndApply = useCallback(
    async (artifactId: string, patch: Partial<ArtifactRow>) => {
      if (!repoId) return;

      const currentRows = rows;
      const nextRows = currentRows.map((row) => {
        if (row.artifact.id !== artifactId) return row;
        const updated = { ...row, ...patch };
        if (
          patch.projectPath !== undefined &&
          !updated.projectPath.trim() &&
          defaultProjectPath
        ) {
          updated.projectPath = defaultProjectPath;
        }
        return updated;
      });

      setRows(nextRows);
      setApplyingId(artifactId);
      setError(null);

      try {
        const next = rowsToInstallations(nextRows, repoId, installations);
        await api.saveInstallations(next);
        setInstallations(next);
        await api.apply();
      } catch (err) {
        setRows(currentRows);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setApplyingId(null);
      }
    },
    [repoId, rows, installations, defaultProjectPath],
  );

  function updateProjectPath(artifactId: string, path: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.artifact.id === artifactId ? { ...row, projectPath: path } : row,
      ),
    );

    const pathTrimmed = path.trim();
    if (pathTrimmed) {
      void api
        .artifacts(repoId, pathTrimmed)
        .then(({ artifacts: list }) => {
          setRows((current) =>
            current.map((row) => {
              const artifact = list.find((a) => a.id === row.artifact.id);
              return artifact ? { ...row, artifact } : row;
            }),
          );
        })
        .catch(() => {});
    }
  }

  function handleGlobalClick(artifactId: string) {
    const row = rows.find((r) => r.artifact.id === artifactId);
    if (!row || isGlobalDisabled(row)) return;

    const global = !row.global;
    void persistAndApply(artifactId, {
      global,
      project: global ? false : row.project,
    });
  }

  function handleProjectClick(artifactId: string) {
    const row = rows.find((r) => r.artifact.id === artifactId);
    if (!row || isProjectDisabled(row)) return;

    const project = !row.project;
    void persistAndApply(artifactId, {
      project,
      global: project ? false : row.global,
    });
  }

  function handleProjectPathBlur(artifactId: string) {
    const row = rows.find((r) => r.artifact.id === artifactId);
    if (!row?.project) return;
    void persistAndApply(artifactId, { projectPath: row.projectPath });
  }

  const repoOptions = repos.map((r) => ({ value: r.id, label: r.id }));

  return (
    <Stack gap="lg">
      <Title order={2}>{title}</Title>

      <Select
        label="Repository"
        placeholder="No repositories"
        data={repoOptions}
        value={repoId || null}
        onChange={(value) => setRepoId(value ?? "")}
        disabled={repos.length === 0}
        maw={400}
      />

      {error && (
        <Alert color="red" title="Error" variant="light">
          {error}
        </Alert>
      )}

      {visibleRows.length === 0 ? (
        <Text c="dimmed">{emptyHint}</Text>
      ) : (
        <ArtifactCardGrid>
          {visibleRows.map((row) => (
            <ArtifactCard
              key={row.artifact.id}
              row={row}
              applying={applyingId === row.artifact.id}
              onGlobalClick={() => handleGlobalClick(row.artifact.id)}
              onProjectClick={() => handleProjectClick(row.artifact.id)}
              onProjectPathChange={(path) =>
                updateProjectPath(row.artifact.id, path)
              }
              onProjectPathBlur={() => handleProjectPathBlur(row.artifact.id)}
            />
          ))}
        </ArtifactCardGrid>
      )}

      <datalist id="recent-projects">
        {projectSuggestions.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </Stack>
  );
}
