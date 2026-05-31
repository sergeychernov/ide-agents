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
  applyAgentInstallDependencies,
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
    return {
      artifact,
      global: existing?.global ?? false,
      project: existing?.project ?? false,
      projectPath: defaultProjectPath,
      installationId: existing?.id ?? null,
    };
  });
}

function rowsToInstallations(
  rows: ArtifactRow[],
  repoId: string,
  existing: Installation[],
  defaultProjectPath: string,
): Installation[] {
  const other = existing.filter((i) => i.repoId !== repoId);
  const previous = existing.filter((i) => i.repoId === repoId);
  const current: Installation[] = [];

  for (const row of rows) {
    const prev = previous.find((i) => i.artifactId === row.artifact.id);
    // Active install uses launch cwd only; keep previous path when off for symlink removal.
    const projectPath = row.project
      ? defaultProjectPath || null
      : (prev?.projectPath ?? null);

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

    loadArtifacts(repoId, installations, defaultProjectPath).catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
  }, [repoId, installations, defaultProjectPath, sessionReady, loadArtifacts]);

  const persistAndApply = useCallback(
    async (artifactId: string, patch: Partial<ArtifactRow>) => {
      if (!repoId) return;

      const currentRows = rows;
      const patchedRows = currentRows.map((row) => {
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
      const nextRows = applyAgentInstallDependencies(
        patchedRows,
        artifactId,
        patch,
        defaultProjectPath,
      );

      setRows(nextRows);
      setApplyingId(artifactId);
      setError(null);

      try {
        const next = rowsToInstallations(
          nextRows,
          repoId,
          installations,
          defaultProjectPath,
        );
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

  function handleGlobalClick(artifactId: string) {
    const row = rows.find((r) => r.artifact.id === artifactId);
    if (!row || isGlobalDisabled(row, rows)) return;

    void persistAndApply(artifactId, { global: !row.global });
  }

  function handleProjectClick(artifactId: string) {
    const row = rows.find((r) => r.artifact.id === artifactId);
    if (!row || isProjectDisabled(row, rows)) return;

    void persistAndApply(artifactId, {
      project: !row.project,
      ...(!row.project ? { projectPath: defaultProjectPath } : {}),
    });
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
              rows={rows}
              applying={applyingId === row.artifact.id}
              onGlobalClick={() => handleGlobalClick(row.artifact.id)}
              onProjectClick={() => handleProjectClick(row.artifact.id)}
            />
          ))}
        </ArtifactCardGrid>
      )}

    </Stack>
  );
}
