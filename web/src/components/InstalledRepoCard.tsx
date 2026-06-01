import { Button, Code, Group, Paper, Stack, Text } from "@mantine/core";
import type { Repo } from "../api/client";
import RepoUrlLine from "./RepoUrlLine";
import headerClasses from "./repoCardHeader.module.css";
import hoverClasses from "./repoCardHover.module.css";
import { useRepoCardOpen } from "./useRepoCardOpen";

function repoStatus(repo: Repo): string {
  const parts = [repo.git.dirty ? "Dirty" : "Clean"];
  if (repo.git.behind !== null && repo.git.behind > 0) {
    parts.push(`${repo.git.behind} behind`);
  } else if (repo.git.behind === 0) {
    parts.push("up to date");
  }
  return parts.join(" · ");
}

function contentsSummary(repo: Repo): string {
  const skills = `${repo.skillCount} skill${repo.skillCount === 1 ? "" : "s"}`;
  const agents =
    repo.agentCount > 0
      ? ` · ${repo.agentCount} agent${repo.agentCount === 1 ? "" : "s"}`
      : "";
  return skills + agents;
}

export interface InstalledRepoCardProps {
  repo: Repo;
  loading?: boolean;
  onPull: () => void;
  onCheckUpdates: () => void;
  onBootstrap?: () => void;
  onDelete: () => void;
}

export default function InstalledRepoCard({
  repo,
  loading,
  onPull,
  onCheckUpdates,
  onBootstrap,
  onDelete,
}: InstalledRepoCardProps) {
  const sha = repo.git.sha?.slice(0, 8) ?? "—";
  const isEmpty = repo.skillCount === 0 && repo.agentCount === 0;
  const { cardClassName, togglePinned } = useRepoCardOpen();

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      tabIndex={0}
      className={cardClassName}
      onClick={togglePinned}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <div className={headerClasses.repoTitleRow}>
            <Text fw={600} style={{ flexShrink: 0 }}>
              {repo.id}
            </Text>
            <div className={headerClasses.repoUrlWrap}>
              <RepoUrlLine url={repo.url} />
            </div>
          </div>
          <Text
            size="sm"
            c="dimmed"
            ta="right"
            className={hoverClasses.collapsedMeta}
          >
            {contentsSummary(repo)}
            {" · "}
            {repo.git.branch ?? "—"}
          </Text>
        </Group>

        <div className={hoverClasses.hoverDetails}>
          <div className={hoverClasses.hoverDetailsInner}>
            <Group
              align="flex-end"
              justify="space-between"
              gap="sm"
              wrap="wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                <Text size="sm" style={{ lineHeight: 1.45 }}>
                  <Text span c="dimmed">
                    Catalog{" "}
                  </Text>
                  {contentsSummary(repo)}
                  <Text span c="dimmed">
                    {" "}
                    · {repo.git.branch ?? "—"} @{" "}
                  </Text>
                  <Code>{sha}</Code>
                  <Text span c="dimmed">
                    {" "}
                    ·{" "}
                  </Text>
                  {repoStatus(repo)}
                </Text>
                <Text size="sm" style={{ lineHeight: 1.45 }}>
                  <Text span c="dimmed">
                    Local{" "}
                  </Text>
                  <Code
                    style={{
                      wordBreak: "break-all",
                      whiteSpace: "normal",
                    }}
                  >
                    {repo.localPath}
                  </Code>
                </Text>
              </Stack>

              <Group gap="xs" wrap="wrap" style={{ flexShrink: 0 }}>
                {isEmpty && onBootstrap && (
                  <Button
                    variant="filled"
                    size="sm"
                    disabled={loading}
                    onClick={onBootstrap}
                  >
                    Add starter template
                  </Button>
                )}
                <Button
                  variant="light"
                  size="sm"
                  disabled={loading}
                  onClick={onPull}
                >
                  Pull
                </Button>
                <Button
                  variant="light"
                  size="sm"
                  disabled={loading}
                  onClick={onCheckUpdates}
                >
                  Check updates
                </Button>
                <Button
                  variant="light"
                  color="red"
                  size="sm"
                  disabled={loading}
                  onClick={onDelete}
                >
                  Remove
                </Button>
              </Group>
            </Group>
          </div>
        </div>
      </Stack>
    </Paper>
  );
}
