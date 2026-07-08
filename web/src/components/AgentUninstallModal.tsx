import { useEffect, useState } from "react";
import { Box, Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import type { ArtifactRow, InstallScope } from "./artifactRow";

export interface SubagentSkillOption {
  id: string;
  name: string;
}

export interface SubagentOption {
  id: string;
  name: string;
  skills: SubagentSkillOption[];
}

export interface AgentUninstallModalProps {
  opened: boolean;
  agentName: string;
  scope: InstallScope;
  deletableSkills: ArtifactRow[];
  deletableSubagents?: SubagentOption[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (
    selectedSkillIds: string[],
    selectedSubagentIds: string[],
    selectedSubagentSkillIds: string[],
  ) => void;
}

export default function AgentUninstallModal({
  opened,
  agentName,
  scope,
  deletableSkills,
  deletableSubagents = [],
  loading,
  onClose,
  onConfirm,
}: AgentUninstallModalProps) {
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedSubagents, setSelectedSubagents] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSubagentSkills, setSelectedSubagentSkills] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    if (opened) {
      setSelectedSkills(new Set());
      setSelectedSubagents(new Set());
      setSelectedSubagentSkills(new Set());
    }
  }, [opened, agentName, scope]);

  function toggleSkill(skillId: string, checked: boolean) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (checked) next.add(skillId);
      else next.delete(skillId);
      return next;
    });
  }

  function toggleSubagent(agentId: string, checked: boolean) {
    setSelectedSubagents((prev) => {
      const next = new Set(prev);
      if (checked) next.add(agentId);
      else next.delete(agentId);
      return next;
    });
  }

  function toggleSubagentSkill(skillId: string, checked: boolean) {
    setSelectedSubagentSkills((prev) => {
      const next = new Set(prev);
      if (checked) next.add(skillId);
      else next.delete(skillId);
      return next;
    });
  }

  const hasSkills = deletableSkills.length > 0;
  const hasSubagents = deletableSubagents.length > 0;

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
          Optionally turn off the same scope for skills and subagents that are
          only required by this agent.
        </Text>

        {hasSkills ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Skills
            </Text>
            {deletableSkills.map((skillRow) => (
              <Checkbox
                key={`skill-${skillRow.artifact.id}`}
                label={skillRow.artifact.name}
                checked={selectedSkills.has(skillRow.artifact.id)}
                onChange={(event) =>
                  toggleSkill(skillRow.artifact.id, event.currentTarget.checked)
                }
                disabled={loading}
              />
            ))}
          </Stack>
        ) : null}

        {hasSubagents ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Subagents
            </Text>
            {deletableSubagents.map((sub) => {
              const subSelected = selectedSubagents.has(sub.id);
              return (
                <Stack key={`sub-${sub.id}`} gap={6}>
                  <Checkbox
                    label={sub.name}
                    checked={subSelected}
                    onChange={(event) =>
                      toggleSubagent(sub.id, event.currentTarget.checked)
                    }
                    disabled={loading}
                  />
                  {sub.skills.length > 0 ? (
                    <Stack gap={4} pl={28}>
                      {sub.skills.map((skill) => (
                        <Box key={`subskill-${sub.id}-${skill.id}`}>
                          <Checkbox
                            label={`${skill.name} (skill)`}
                            size="xs"
                            checked={selectedSubagentSkills.has(skill.id)}
                            onChange={(event) =>
                              toggleSubagentSkill(
                                skill.id,
                                event.currentTarget.checked,
                              )
                            }
                            disabled={loading || !subSelected}
                          />
                        </Box>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        ) : null}

        {!hasSkills && !hasSubagents ? (
          <Text size="sm" c="dimmed">
            No other skills or subagents depend on this agent.
          </Text>
        ) : null}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={loading}
            onClick={() =>
              onConfirm(
                [...selectedSkills],
                [...selectedSubagents],
                [...selectedSubagentSkills],
              )
            }
          >
            Turn off
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
