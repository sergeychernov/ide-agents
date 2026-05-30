import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { api, type GitStatus, type Repo } from "../api/client";
import {
  KNOWN_SKILL_REPOS,
  isKnownRepoInstalled,
  type KnownSkillRepo,
} from "../knownRepos";

function formatBehind(git: GitStatus): string {
  if (git.error) return git.error;
  if (git.behind === null) return "Unknown (fetch to check)";
  if (git.behind === 0) return "Up to date";
  return `${git.behind} commit(s) behind remote`;
}

function repoStatus(repo: Repo): string {
  const parts = [repo.git.dirty ? "Dirty working tree" : "Clean"];
  if (repo.git.behind !== null && repo.git.behind > 0) {
    parts.push(`${repo.git.behind} behind`);
  } else if (repo.git.behind === 0) {
    parts.push("up to date");
  }
  return parts.join(" · ");
}

interface RepositoriesProps {
  onReposChange?: () => void;
}

export default function Repositories({ onReposChange }: RepositoriesProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [ref, setRef] = useState("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    const data = await api.repos();
    setRepos(data.repos);
    if (data.repos.length > 0 && !selectedId) {
      setSelectedId(data.repos[0]!.id);
    }
    onReposChange?.();
  }, [selectedId, onReposChange]);

  useEffect(() => {
    loadRepos().catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
  }, [loadRepos]);

  const selected = repos.find((r) => r.id === selectedId) ?? null;

  const installedUrls = useMemo(() => repos.map((r) => r.url), [repos]);

  const suggestedToAdd = useMemo(
    () =>
      KNOWN_SKILL_REPOS.filter(
        (known) => !isKnownRepoInstalled(known, installedUrls),
      ),
    [installedUrls],
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { repo } = await api.addRepo(url.trim(), ref.trim() || "main");
      setRepos((prev) => [...prev, repo]);
      setSelectedId(repo.id);
      setUrl("");
      setMessage(`Cloned ${repo.url}`);
      onReposChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleFetch(repoId: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { git } = await api.fetchRepo(repoId);
      setRepos((prev) =>
        prev.map((r) => (r.id === repoId ? { ...r, git } : r)),
      );
      setMessage(formatBehind(git));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckUpdates(repoId: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { git } = await api.checkRepoUpdates(repoId);
      setRepos((prev) =>
        prev.map((r) => (r.id === repoId ? { ...r, git } : r)),
      );
      setMessage(formatBehind(git));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePull(repoId: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { git } = await api.pullRepo(repoId);
      setRepos((prev) =>
        prev.map((r) => (r.id === repoId ? { ...r, git } : r)),
      );
      setMessage("Pull completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddKnown(known: KnownSkillRepo) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { repo } = await api.addRepo(known.url, known.ref, known.id);
      setRepos((prev) => [...prev, repo]);
      setSelectedId(repo.id);
      setMessage(`Cloned ${known.name}`);
      onReposChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(repoId: string) {
    if (!confirm("Remove this repository from config?")) return;
    setLoading(true);
    setError(null);
    try {
      await api.deleteRepo(repoId);
      setRepos((prev) => prev.filter((r) => r.id !== repoId));
      if (selectedId === repoId) {
        setSelectedId(null);
      }
      onReposChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Repositories</Title>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Title order={4}>Add repository</Title>
          <form onSubmit={handleAdd}>
            <Stack gap="md">
              <TextInput
                label="Git URL"
                placeholder="https://github.com/org/skills.git or file:///path/to/repo"
                value={url}
                onChange={(e) => setUrl(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Ref (branch/tag)"
                value={ref}
                onChange={(e) => setRef(e.currentTarget.value)}
              />
              <Group>
                <Button type="submit" loading={loading}>
                  Add / Clone
                </Button>
              </Group>
            </Stack>
          </form>
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

      {suggestedToAdd.length > 0 && (
        <Stack gap="md">
          <Title order={4}>Suggested skill repositories</Title>
          <Text size="sm" c="dimmed">
            Public catalogs with <Code>SKILL.md</Code> — one click to clone.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {suggestedToAdd.map((known) => (
              <Paper key={known.id} withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>{known.name}</Text>
                  <Text size="sm" c="dimmed">
                    {known.description}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                    {known.url}
                  </Text>
                  <Button
                    variant="light"
                    size="sm"
                    disabled={loading}
                    onClick={() => handleAddKnown(known)}
                  >
                    Add / Clone
                  </Button>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      )}

      <Stack gap="md">
        <Title order={4}>Your repositories</Title>
        {repos.length === 0 ? (
          <Text c="dimmed">
            No repositories yet. Pick a suggested catalog above or add a custom URL.
          </Text>
        ) : (
          repos.map((repo) => {
            const isSelected = selectedId === repo.id;
            return (
              <Paper
                key={repo.id}
                withBorder
                p="md"
                radius="md"
                style={{
                  cursor: "pointer",
                  borderColor: isSelected
                    ? "var(--mantine-color-blue-outline)"
                    : undefined,
                  background: isSelected
                    ? "var(--mantine-color-blue-light)"
                    : undefined,
                }}
                onClick={() => setSelectedId(repo.id)}
              >
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start" wrap="wrap">
                    <Stack gap={2}>
                      <Text fw={600}>{repo.id}</Text>
                      <Text size="sm" c="dimmed" style={{ wordBreak: "break-all" }}>
                        {repo.url}
                      </Text>
                    </Stack>
                    {isSelected && <Badge color="blue">Selected</Badge>}
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <Text size="sm">
                      <Text span c="dimmed">
                        Contents:{" "}
                      </Text>
                      {repo.skillCount} skill{repo.skillCount === 1 ? "" : "s"}
                      {repo.agentCount > 0
                        ? ` · ${repo.agentCount} agent${repo.agentCount === 1 ? "" : "s"}`
                        : ""}
                    </Text>
                    <Text size="sm">
                      <Text span c="dimmed">
                        Local path:{" "}
                      </Text>
                      <Code block mt={4}>
                        {repo.localPath}
                      </Code>
                    </Text>
                    <Text size="sm">
                      <Text span c="dimmed">
                        Branch:{" "}
                      </Text>
                      {repo.git.branch ?? "—"}
                    </Text>
                    <Text size="sm">
                      <Text span c="dimmed">
                        Commit:{" "}
                      </Text>
                      <Code>{repo.git.sha?.slice(0, 8) ?? "—"}</Code>
                    </Text>
                    <Text size="sm">
                      <Text span c="dimmed">
                        Status:{" "}
                      </Text>
                      {repoStatus(repo)}
                    </Text>
                  </SimpleGrid>

                  {isSelected && (
                    <Group
                      gap="xs"
                      mt="xs"
                      onClick={(e) => e.stopPropagation()}
                      wrap="wrap"
                    >
                      <Button
                        variant="light"
                        size="sm"
                        disabled={loading}
                        onClick={() => handleFetch(repo.id)}
                      >
                        Fetch
                      </Button>
                      <Button
                        variant="light"
                        size="sm"
                        disabled={loading}
                        onClick={() => handlePull(repo.id)}
                      >
                        Pull
                      </Button>
                      <Button
                        variant="light"
                        size="sm"
                        disabled={loading}
                        onClick={() => handleCheckUpdates(repo.id)}
                      >
                        Check for updates
                      </Button>
                      <Button
                        variant="light"
                        color="red"
                        size="sm"
                        disabled={loading}
                        onClick={() => handleDelete(repo.id)}
                      >
                        Remove
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Paper>
            );
          })
        )}
      </Stack>

      {selected && (
        <Text size="sm" c="dimmed">
          Selected: <Text span fw={600}>{selected.id}</Text>. Use Skills or Agents
          to install from this repo.
        </Text>
      )}
    </Stack>
  );
}
