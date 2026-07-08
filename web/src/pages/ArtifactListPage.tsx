import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Select, Stack, Text, Title } from "@mantine/core";
import {
  api,
  type ArtifactKind,
  type Artifact,
  type Installation,
  type Repo,
} from "../api/client";
import AgentUninstallModal, {
  type SubagentOption,
} from "../components/AgentUninstallModal";
import ArtifactCard from "../components/ArtifactCard";
import ArtifactCardGrid from "../components/ArtifactCardGrid";
import type { ArtifactRow } from "../components/artifactRow";
import {
  applyPatchesToRows,
  artifactRowKey,
  buildAgentScopeOffPatches,
  deletableDependentSkillsForAgentInScope,
  deletableDependentSubagentsForAgentInScope,
  subagentDeletableSkillsInScope,
  type InstallScope,
  findInstallation,
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
    const existing = findInstallation(installations, repoId, artifact);
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
    const prev = previous.find(
      (i) =>
        i.artifactId === row.artifact.id && i.kind === row.artifact.kind,
    );
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
  const [pendingAgentOff, setPendingAgentOff] = useState<{
    rowKey: string;
    scope: InstallScope;
    patch: Partial<ArtifactRow>;
  } | null>(null);

  const visibleRows = useMemo(
    () => rows.filter((row) => row.artifact.kind === kind),
    [rows, kind],
  );

  const filteredRepos = useMemo(
    () =>
      repos.filter((r) =>
        kind === "agent" ? r.agentCount > 0 : r.skillCount > 0,
      ),
    [repos, kind],
  );

  const loadBase = useCallback(async () => {
    const [reposData, instData] = await Promise.all([
      api.repos(),
      api.installations(),
    ]);
    setRepos(reposData.repos);
    setInstallations(instData.installations);
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
    if (filteredRepos.length === 0) {
      setRepoId("");
      return;
    }
    setRepoId((prev) =>
      filteredRepos.some((r) => r.id === prev) ? prev : filteredRepos[0]!.id,
    );
  }, [filteredRepos]);

  useEffect(() => {
    if (!repoId || !sessionReady) return;

    loadArtifacts(repoId, installations, defaultProjectPath).catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
  }, [repoId, installations, defaultProjectPath, sessionReady, loadArtifacts]);

  const persistAndApplyPatches = useCallback(
    async (
      patchesByKey: Record<string, Partial<ArtifactRow>>,
      applyingRowKey: string,
    ) => {
      if (!repoId || Object.keys(patchesByKey).length === 0) return;

      const currentRows = rows;
      const nextRows = applyPatchesToRows(
        currentRows,
        patchesByKey,
        defaultProjectPath,
      );

      setRows(nextRows);
      setApplyingId(applyingRowKey);
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
        const { results } = await api.apply();
        const failures = results.filter((r) => r.error);
        if (failures.length > 0) {
          const preview = failures
            .slice(0, 3)
            .map((r) => `${r.path}: ${r.error}`)
            .join("\n");
          const more =
            failures.length > 3 ? `\n…and ${failures.length - 3} more` : "";
          setError(
            `Could not remove some symlinks (target is not a symlink or is missing):\n${preview}${more}`,
          );
        }
      } catch (err) {
        setRows(currentRows);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setApplyingId(null);
      }
    },
    [repoId, rows, installations, defaultProjectPath],
  );

  const persistAndApply = useCallback(
    async (row: ArtifactRow, patch: Partial<ArtifactRow>) => {
      const key = artifactRowKey(row.artifact);
      await persistAndApplyPatches({ [key]: patch }, key);
    },
    [persistAndApplyPatches],
  );

  function handleScopeClick(row: ArtifactRow, scope: InstallScope) {
    if (!row) return;
    if (scope === "global" && isGlobalDisabled(row, rows)) return;
    if (scope === "project" && isProjectDisabled(row, rows)) return;

    const patch: Partial<ArtifactRow> =
      scope === "global"
        ? { global: !row.global }
        : {
            project: !row.project,
            ...(!row.project ? { projectPath: defaultProjectPath } : {}),
          };

    const turningOff =
      (scope === "global" && row.global) || (scope === "project" && row.project);

    if (row.artifact.kind === "agent" && turningOff) {
      const deletable = deletableDependentSkillsForAgentInScope(row, rows, scope);
      const deletableSubs = deletableDependentSubagentsForAgentInScope(
        row,
        rows,
        scope,
      );
      if (deletable.length > 0 || deletableSubs.length > 0) {
        setPendingAgentOff({
          rowKey: artifactRowKey(row.artifact),
          scope,
          patch,
        });
        return;
      }
    }

    void persistAndApply(row, patch);
  }

  function handleAgentOffConfirm(
    selectedSkillIds: string[],
    selectedSubagentIds: string[],
    selectedSubagentSkillIds: string[],
  ) {
    if (!pendingAgentOff) return;
    const agentRow = rows.find(
      (r) => artifactRowKey(r.artifact) === pendingAgentOff.rowKey,
    );
    if (!agentRow) {
      setPendingAgentOff(null);
      return;
    }
    const { scope, patch } = pendingAgentOff;
    setPendingAgentOff(null);

    // Only nested skills whose owning subagent is actually selected AND that no
    // other still-installed agent uses in this scope make it into the patches.
    const requestedNested = new Set(selectedSubagentSkillIds);
    const safeNested: string[] = [];
    for (const subId of selectedSubagentIds) {
      const removable = subagentDeletableSkillsInScope(
        agentRow,
        subId,
        selectedSubagentIds,
        rows,
        scope,
      );
      for (const skillRow of removable) {
        if (requestedNested.has(skillRow.artifact.id)) {
          safeNested.push(skillRow.artifact.id);
        }
      }
    }

    const allSkillIds = Array.from(
      new Set([...selectedSkillIds, ...safeNested]),
    );
    void persistAndApplyPatches(
      buildAgentScopeOffPatches(
        agentRow,
        scope,
        patch,
        allSkillIds,
        selectedSubagentIds,
      ),
      artifactRowKey(agentRow.artifact),
    );
  }

  const pendingAgentRow = pendingAgentOff
    ? rows.find((r) => artifactRowKey(r.artifact) === pendingAgentOff.rowKey)
    : undefined;
  const pendingDeletableSkills =
    pendingAgentRow && pendingAgentOff
      ? deletableDependentSkillsForAgentInScope(
          pendingAgentRow,
          rows,
          pendingAgentOff.scope,
        )
      : [];
  const pendingDeletableSubagents =
    pendingAgentRow && pendingAgentOff
      ? deletableDependentSubagentsForAgentInScope(
          pendingAgentRow,
          rows,
          pendingAgentOff.scope,
        )
      : [];
  const pendingDeletableSubagentOptions: SubagentOption[] =
    pendingAgentRow && pendingAgentOff
      ? pendingDeletableSubagents.map((subRow) => {
          const siblingIds = pendingDeletableSubagents.map(
            (s) => s.artifact.id,
          );
          const skills = subagentDeletableSkillsInScope(
            pendingAgentRow,
            subRow.artifact.id,
            siblingIds,
            rows,
            pendingAgentOff.scope,
          ).map((skillRow) => ({
            id: skillRow.artifact.id,
            name: skillRow.artifact.name,
          }));
          return { id: subRow.artifact.id, name: subRow.artifact.name, skills };
        })
      : [];

  const repoOptions = filteredRepos.map((r) => ({
    value: r.id,
    label: r.id,
  }));

  return (
    <Stack gap="lg">
      <Title order={2}>{title}</Title>

      <Select
        label="Repository"
        placeholder="No repositories"
        data={repoOptions}
        value={repoId || null}
        onChange={(value) => setRepoId(value ?? "")}
        disabled={filteredRepos.length === 0}
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
              key={artifactRowKey(row.artifact)}
              row={row}
              rows={rows}
              applying={applyingId === artifactRowKey(row.artifact)}
              onGlobalClick={() => handleScopeClick(row, "global")}
              onProjectClick={() => handleScopeClick(row, "project")}
            />
          ))}
        </ArtifactCardGrid>
      )}

      {kind === "agent" && pendingAgentRow && pendingAgentOff ? (
        <AgentUninstallModal
          opened
          agentName={pendingAgentRow.artifact.name}
          scope={pendingAgentOff.scope}
          deletableSkills={pendingDeletableSkills}
          deletableSubagents={pendingDeletableSubagentOptions}
          loading={
            pendingAgentRow !== undefined &&
            applyingId === artifactRowKey(pendingAgentRow.artifact)
          }
          onClose={() => setPendingAgentOff(null)}
          onConfirm={handleAgentOffConfirm}
        />
      ) : null}
    </Stack>
  );
}
