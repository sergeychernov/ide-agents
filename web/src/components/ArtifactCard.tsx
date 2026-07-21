import {
  ActionIcon,
  Badge,
  Card,
  Code,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconFolder, IconWorld } from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";
import type { ArtifactRow } from "./artifactRow";
import {
  globalDisabledReason,
  isGlobalDisabled,
  isProjectDisabled,
  projectDisabledReason,
} from "./artifactRow";

interface ScopeToggleProps {
  active: boolean;
  disabled: boolean;
  loading?: boolean;
  label: string;
  reason?: string;
  icon: TablerIcon;
  onClick: () => void;
}

function ScopeToggle({
  active,
  disabled,
  loading,
  label,
  reason,
  icon: Icon,
  onClick,
}: ScopeToggleProps) {
  const button = (
    <ActionIcon
      variant={active ? "filled" : "light"}
      color={active ? "blue" : "gray"}
      disabled={disabled || loading}
      loading={loading}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon size={18} stroke={1.75} />
    </ActionIcon>
  );

  return (
    <Tooltip
      label={disabled && reason ? reason : label}
      multiline={Boolean(disabled && reason)}
      maw={280}
      withArrow
    >
      <span style={{ display: "inline-flex" }}>{button}</span>
    </Tooltip>
  );
}

export interface ArtifactCardProps {
  row: ArtifactRow;
  rows: ArtifactRow[];
  applying?: boolean;
  onGlobalClick: () => void;
  onProjectClick: () => void;
}

export default function ArtifactCard({
  row,
  rows,
  applying,
  onGlobalClick,
  onProjectClick,
}: ArtifactCardProps) {
  const skillDependencies = row.artifact.skillDependencies ?? [];
  const subagentDependencies = row.artifact.subagentDependencies ?? [];
  const codexMeta = row.artifact.codexMeta;
  const title = codexMeta?.displayName || row.artifact.name;
  const description =
    row.artifact.description || codexMeta?.shortDescription || "";

  return (
    <Card withBorder padding="lg" radius="md" w="100%" maw={480}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Title order={4} lineClamp={1}>
              {title}
            </Title>
            {row.artifact.bucket ? (
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                <Badge variant="light" color="gray" size="sm">
                  {row.artifact.bucket}
                </Badge>
                <Code
                  style={{
                    fontSize: "0.7rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={row.artifact.sourcePath}
                >
                  {row.artifact.sourcePath}
                </Code>
              </Group>
            ) : null}
          </Stack>
          <Group gap="xs" wrap="nowrap">
            <ScopeToggle
              active={row.global}
              disabled={isGlobalDisabled(row, rows)}
              loading={applying}
              label="Global"
              reason={globalDisabledReason(row, rows)}
              icon={IconWorld}
              onClick={onGlobalClick}
            />
            <ScopeToggle
              active={row.project}
              disabled={isProjectDisabled(row, rows)}
              loading={applying}
              label="Project"
              reason={projectDisabledReason(row, rows)}
              icon={IconFolder}
              onClick={onProjectClick}
            />
          </Group>
        </Group>

        {description ? (
          <Text size="sm" c="dimmed" lineClamp={3}>
            {description}
          </Text>
        ) : null}

        {codexMeta?.defaultPrompt ? (
          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed">
              Suggested prompt
            </Text>
            <Text
              size="sm"
              c="dimmed"
              lineClamp={3}
              style={{
                borderLeft: "2px solid var(--mantine-color-gray-4)",
                paddingLeft: "0.5rem",
                fontStyle: "italic",
              }}
            >
              {codexMeta.defaultPrompt}
            </Text>
          </Stack>
        ) : null}

        {row.artifact.kind === "agent" && skillDependencies.length > 0 ? (
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              Skills
            </Text>
            <Group gap="xs">
              {skillDependencies.map((skill) => (
                <Tooltip
                  key={skill.id}
                  label={skill.description || skill.name}
                  multiline
                  maw={280}
                  withArrow
                  disabled={!skill.description}
                >
                  <Badge variant="light" color="gray" style={{ cursor: "default" }}>
                    {skill.name}
                  </Badge>
                </Tooltip>
              ))}
            </Group>
          </Stack>
        ) : null}

        {row.artifact.kind === "agent" && subagentDependencies.length > 0 ? (
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              Subagents
            </Text>
            <Group gap="xs">
              {subagentDependencies.map((agent) => (
                <Tooltip
                  key={agent.id}
                  label={agent.description || agent.name}
                  multiline
                  maw={280}
                  withArrow
                  disabled={!agent.description}
                >
                  <Badge
                    variant="light"
                    color="indigo"
                    style={{ cursor: "default" }}
                  >
                    {agent.name}
                  </Badge>
                </Tooltip>
              ))}
            </Group>
          </Stack>
        ) : null}

        <TextInput
          label="Project path"
          description="Directory where ide-agents was started"
          size="sm"
          value={row.projectPath}
          readOnly
          disabled={applying}
        />

        {row.otherProjectPaths.length > 0 ? (
          <Text size="xs" c="dimmed">
            Also installed in:{" "}
            {row.otherProjectPaths
              .map((p) => p.split("/").filter(Boolean).pop() ?? p)
              .join(", ")}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
