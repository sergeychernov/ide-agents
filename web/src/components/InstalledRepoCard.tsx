import {
  Badge,
  Button,
  Code,
  Group,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import type { Repo } from "../api/client";

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
  expanded: boolean;
  loading?: boolean;
  onToggle: () => void;
  onPull: () => void;
  onCheckUpdates: () => void;
  onBootstrap?: () => void;
  onDelete: () => void;
}

export default function InstalledRepoCard({
  repo,
  expanded,
  loading,
  onToggle,
  onPull,
  onCheckUpdates,
  onBootstrap,
  onDelete,
}: InstalledRepoCardProps) {
  const sha = repo.git.sha?.slice(0, 8) ?? "—";
  const isEmpty = repo.skillCount === 0 && repo.agentCount === 0;

  return (
    <Paper
      withBorder
      p={expanded ? "sm" : "md"}
      radius="md"
      style={{
        cursor: "pointer",
        borderColor: expanded
          ? "var(--mantine-color-blue-outline)"
          : undefined,
        background: expanded
          ? "var(--mantine-color-blue-light)"
          : undefined,
      }}
      onClick={onToggle}
    >
      <Stack gap={expanded ? "xs" : "sm"}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
            <Text fw={600}>{repo.id}</Text>
            <Text size="sm" c="dimmed" style={{ wordBreak: "break-all" }}>
              {repo.url}
            </Text>
          </Stack>
          {expanded ? (
            <Badge color="blue" style={{ flexShrink: 0 }}>
              Selected
            </Badge>
          ) : (
            <Text size="sm" c="dimmed" ta="right" style={{ flexShrink: 0 }}>
              {contentsSummary(repo)}
              {" · "}
              {repo.git.branch ?? "—"}
            </Text>
          )}
        </Group>

        {expanded && (
          <Group
            align="flex-end"
            justify="space-between"
            gap="sm"
            wrap="wrap"
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

            <Group
              gap="xs"
              wrap="wrap"
              style={{ flexShrink: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
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
        )}
      </Stack>
    </Paper>
  );
}
