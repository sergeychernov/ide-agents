import {
  ActionIcon,
  Card,
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
  applying?: boolean;
  onGlobalClick: () => void;
  onProjectClick: () => void;
  onProjectPathChange: (path: string) => void;
  onProjectPathBlur: () => void;
}

export default function ArtifactCard({
  row,
  applying,
  onGlobalClick,
  onProjectClick,
  onProjectPathChange,
  onProjectPathBlur,
}: ArtifactCardProps) {
  return (
    <Card withBorder padding="lg" radius="md" w="100%" maw={480}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Title order={4} lineClamp={1} style={{ flex: 1 }}>
            {row.artifact.name}
          </Title>
          <Group gap="xs" wrap="nowrap">
            <ScopeToggle
              active={row.global}
              disabled={isGlobalDisabled(row)}
              loading={applying}
              label="Global"
              reason={globalDisabledReason(row)}
              icon={IconWorld}
              onClick={onGlobalClick}
            />
            <ScopeToggle
              active={row.project}
              disabled={isProjectDisabled(row)}
              loading={applying}
              label="Project"
              reason={projectDisabledReason(row)}
              icon={IconFolder}
              onClick={onProjectClick}
            />
          </Group>
        </Group>

        {row.artifact.description ? (
          <Text size="sm" c="dimmed" lineClamp={3}>
            {row.artifact.description}
          </Text>
        ) : null}

        <TextInput
          label="Project path"
          size="sm"
          value={row.projectPath}
          list="recent-projects"
          disabled={applying}
          onChange={(e) => onProjectPathChange(e.currentTarget.value)}
          onBlur={onProjectPathBlur}
        />
      </Stack>
    </Card>
  );
}
