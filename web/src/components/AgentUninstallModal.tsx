import { useEffect, useState } from "react";
import { Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import type { ArtifactRow, InstallScope } from "./artifactRow";

export interface AgentUninstallModalProps {
  opened: boolean;
  agentName: string;
  scope: InstallScope;
  deletableSkills: ArtifactRow[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (selectedSkillIds: string[]) => void;
}

export default function AgentUninstallModal({
  opened,
  agentName,
  scope,
  deletableSkills,
  loading,
  onClose,
  onConfirm,
}: AgentUninstallModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (opened) {
      setSelected(new Set());
    }
  }, [opened, agentName, scope]);

  function toggleSkill(skillId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(skillId);
      } else {
        next.delete(skillId);
      }
      return next;
    });
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Turn off ${agentName} (${scope === "global" ? "Global" : "Project"})?`}
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          {scope === "global"
            ? "Global symlinks for this agent will be removed."
            : "Project symlinks for this agent will be removed."}{" "}
          Also turn off the same scope for skills that are only required by this
          agent?
        </Text>
        <Stack gap="xs">
          {deletableSkills.map((skillRow) => (
            <Checkbox
              key={skillRow.artifact.id}
              label={skillRow.artifact.name}
              checked={selected.has(skillRow.artifact.id)}
              onChange={(event) =>
                toggleSkill(skillRow.artifact.id, event.currentTarget.checked)
              }
              disabled={loading}
            />
          ))}
        </Stack>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={loading}
            onClick={() => onConfirm([...selected])}
          >
            Turn off
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
