import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Code,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { api, type GitStatus, type Repo, type RepoBootstrap } from "../api/client";
import AddRepositoryCard from "../components/AddRepositoryCard";
import InstalledRepoCard from "../components/InstalledRepoCard";
import SuggestedRepoCard from "../components/SuggestedRepoCard";
import {
  KNOWN_SKILL_REPOS,
  isKnownRepoInstalled,
  isPrimaryKnownRepo,
  type KnownSkillRepo,
} from "../knownRepos";

function formatBehind(git: GitStatus): string {
  if (git.error) return git.error;
  if (git.behind === null) return "Unknown (fetch to check)";
  if (git.behind === 0) return "Up to date";
  return `${git.behind} commit(s) behind remote`;
}

function formatAddRepoMessage(
  label: string,
  bootstrap?: RepoBootstrap,
): string {
  if (!bootstrap?.applied) {
    return `Cloned ${label}`;
  }

  const parts = [
    `Cloned ${label} and filled it with the starter template`,
    `(${bootstrap.skillCount} skills, ${bootstrap.agentCount} agents)`,
  ];

  if (bootstrap.pushed) {
    parts.push("— pushed to remote");
  } else if (bootstrap.pushError) {
    parts.push(`— push failed: ${bootstrap.pushError}`);
  }

  return parts.join(" ");
}

interface RepositoriesProps {
  onReposChange?: () => void;
}

export default function Repositories({ onReposChange }: RepositoriesProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [ref, setRef] = useState("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    const data = await api.repos();
    setRepos(data.repos);
    onReposChange?.();
  }, [onReposChange]);

  useEffect(() => {
    loadRepos().catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
  }, [loadRepos]);

  const expandedRepo = repos.find((r) => r.id === expandedId) ?? null;

  function toggleExpanded(repoId: string) {
    setExpandedId((current) => (current === repoId ? null : repoId));
  }

  const installedUrls = useMemo(() => repos.map((r) => r.url), [repos]);

  const suggestedToAdd = useMemo(
    () =>
      KNOWN_SKILL_REPOS.filter(
        (known) => !isKnownRepoInstalled(known, installedUrls),
      ),
    [installedUrls],
  );

  const primarySuggested = suggestedToAdd.find(isPrimaryKnownRepo);
  const otherSuggested = suggestedToAdd.filter(
    (known) => !isPrimaryKnownRepo(known),
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { repo, bootstrap } = await api.addRepo(url.trim(), ref.trim() || "main");
      setRepos((prev) => [...prev, repo]);
      setExpandedId(repo.id);
      setUrl("");
      setMessage(formatAddRepoMessage(repo.url, bootstrap));
      onReposChange?.();
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
      const { repo, bootstrap } = await api.addRepo(known.url, known.ref, known.id);
      setRepos((prev) => [...prev, repo]);
      setExpandedId(repo.id);
      setMessage(formatAddRepoMessage(known.name, bootstrap));
      onReposChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap(repoId: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { repo, bootstrap } = await api.bootstrapRepo(repoId);
      setRepos((prev) =>
        prev.map((r) => (r.id === repoId ? { ...r, ...repo } : r)),
      );
      setMessage(formatAddRepoMessage(repo.url, bootstrap));
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
      if (expandedId === repoId) {
        setExpandedId(null);
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
      <Stack gap="md">
        <Title order={2}>Connect repositories</Title>
        <Text size="sm" c="dimmed">
          Start with public catalogs that include <Code>SKILL.md</Code> — one click to
          clone. For corporate, personal, or lesser-known sources, add a URL below.
          Empty repositories are filled automatically with sample skills, agents, and
          IDE rules.
        </Text>

        {suggestedToAdd.length > 0 && (
          <Stack gap="md">
            {primarySuggested && (
              <SuggestedRepoCard
                repo={primarySuggested}
                primary
                loading={loading}
                onAdd={() => handleAddKnown(primarySuggested)}
              />
            )}
            {otherSuggested.length > 0 && (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {otherSuggested.map((known) => (
                  <SuggestedRepoCard
                    key={known.id}
                    repo={known}
                    loading={loading}
                    onAdd={() => handleAddKnown(known)}
                  />
                ))}
              </SimpleGrid>
            )}
          </Stack>
        )}

        <AddRepositoryCard
          url={url}
          ref={ref}
          loading={loading}
          onUrlChange={setUrl}
          onRefChange={setRef}
          onSubmit={handleAdd}
        />
      </Stack>

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

      <Stack gap="md">
        <Title order={4}>Your repositories</Title>
        {repos.length === 0 ? (
          <Text c="dimmed">
            No repositories yet. Pick a catalog above or add a custom URL.
          </Text>
        ) : (
          repos.map((repo) => (
            <InstalledRepoCard
              key={repo.id}
              repo={repo}
              expanded={expandedId === repo.id}
              loading={loading}
              onToggle={() => toggleExpanded(repo.id)}
              onPull={() => handlePull(repo.id)}
              onCheckUpdates={() => handleCheckUpdates(repo.id)}
              onBootstrap={() => handleBootstrap(repo.id)}
              onDelete={() => handleDelete(repo.id)}
            />
          ))
        )}
      </Stack>

      {expandedRepo && (
        <Text size="sm" c="dimmed">
          Selected: <Text span fw={600}>{expandedRepo.id}</Text>. Use Skills or
          Agents to install from this repo.
        </Text>
      )}
    </Stack>
  );
}
