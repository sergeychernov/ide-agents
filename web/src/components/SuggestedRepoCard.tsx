import { Button, Paper, Stack, Text } from "@mantine/core";
import type { KnownSkillRepo } from "../knownRepos";
import classes from "./SuggestedRepoCard.module.css";

export interface SuggestedRepoCardProps {
  repo: KnownSkillRepo;
  primary?: boolean;
  loading?: boolean;
  onAdd: () => void;
}

function RepoDetails({
  repo,
  loading,
  onAdd,
}: Pick<SuggestedRepoCardProps, "repo" | "loading" | "onAdd">) {
  return (
    <>
      <Text size="sm" c="dimmed">
        {repo.description}
      </Text>
      <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
        {repo.url}
      </Text>
      <Button
        variant="light"
        size="sm"
        disabled={loading}
        onClick={onAdd}
      >
        Add / Clone
      </Button>
    </>
  );
}

export default function SuggestedRepoCard({
  repo,
  primary = false,
  loading,
  onAdd,
}: SuggestedRepoCardProps) {
  if (primary) {
    return (
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>{repo.name}</Text>
          <RepoDetails repo={repo} loading={loading} onAdd={onAdd} />
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      tabIndex={0}
      className={classes.compact}
    >
      <Stack gap="sm">
        <Text fw={600}>{repo.name}</Text>
        <div className={classes.hoverDetails}>
          <div className={classes.hoverDetailsInner}>
            <Stack gap="sm">
              <RepoDetails repo={repo} loading={loading} onAdd={onAdd} />
            </Stack>
          </div>
        </div>
      </Stack>
    </Paper>
  );
}
