import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Checkbox,
  Code,
  CopyButton,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { api, type IdeId, type IdesConfig, type NpmUpdateInfo } from "../api/client";
import { toDisplayPath } from "../pathDisplay";

const IDE_ROWS: { id: IdeId; label: string }[] = [
  { id: "codex", label: "Codex" },
  { id: "claude", label: "Claude" },
  { id: "cursor", label: "Cursor" },
];

export default function Settings() {
  const [ides, setIdes] = useState<IdesConfig | null>(null);
  const [home, setHome] = useState("");
  const [version, setVersion] = useState("");
  const [npmUpdate, setNpmUpdate] = useState<NpmUpdateInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api.settings();
    setIdes(data.ides);
    setHome(data.home);
    setVersion(data.version);
    setNpmUpdate(data.npmUpdate);
  }, []);

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
  }, [load]);

  const persist = useCallback(
    async (next: IdesConfig) => {
      setSaving(true);
      setError(null);
      setMessage(null);
      try {
        const { ides: saved } = await api.saveSettings(next);
        setIdes(saved);
        setMessage("Settings saved");
        await api.apply();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  function updateIde(id: IdeId, patch: Partial<IdesConfig[IdeId]>) {
    if (!ides) return;
    const next = {
      ...ides,
      [id]: { ...ides[id], ...patch },
    };
    const enabledCount = (["cursor", "claude", "codex"] as const).filter(
      (key) => next[key].enabled,
    ).length;
    if (enabledCount === 0) {
      setError("At least one IDE must be enabled");
      return;
    }
    setIdes(next);
    void persist(next);
  }

  function savePath() {
    if (!ides) return;
    void persist(ides);
  }

  if (!ides) {
    return null;
  }

  const homePrefix = home.replace(/\/\.ide-agents$/, "") || home;

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>Settings</Title>
        <Text size="sm" c="dimmed">
          Data directory: <Code>{home}</Code> · v{version}
        </Text>
      </Stack>

      {npmUpdate?.updateAvailable && npmUpdate.latest && (
        <Alert color="blue" title="Доступно обновление" variant="light">
          <Stack gap="xs">
            <Text size="sm">
              Установлена v{npmUpdate.current}, в npm — v{npmUpdate.latest}.
            </Text>
            <Group gap="xs" wrap="nowrap">
              <Code flex={1}>{npmUpdate.installCommand}</Code>
              <CopyButton value={npmUpdate.installCommand} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Скопировано" : "Копировать"} withArrow>
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      variant="subtle"
                      onClick={copy}
                      aria-label="Копировать команду обновления"
                    >
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Stack>
        </Alert>
      )}

      <Paper withBorder p="md" radius="md">
        <Stack gap="lg">
          <Title order={4}>What do you use?</Title>
          <Text size="sm" c="dimmed">
            Enabled tools receive symlinks when you install skills or agents.
            At least one tool should stay enabled.
          </Text>

          {IDE_ROWS.map(({ id, label }) => (
            <Stack key={id} gap="xs">
              <Checkbox
                label={label}
                checked={ides[id].enabled}
                disabled={saving}
                onChange={(e) =>
                  updateIde(id, { enabled: e.currentTarget.checked })
                }
              />
              <TextInput
                label="Config path"
                value={toDisplayPath(ides[id].configPath, homePrefix)}
                disabled={saving || !ides[id].enabled}
                onChange={(e) =>
                  setIdes((prev) =>
                    prev
                      ? {
                          ...prev,
                          [id]: {
                            ...prev[id],
                            configPath: e.currentTarget.value,
                          },
                        }
                      : prev,
                  )
                }
                onBlur={() => savePath()}
              />
            </Stack>
          ))}
        </Stack>
      </Paper>

      {error && (
        <Alert color="red" title="Error" variant="light">
          {error}
        </Alert>
      )}
      {message && (
        <Alert color="green" title="Success" variant="light">
          {message}
        </Alert>
      )}
    </Stack>
  );
}
