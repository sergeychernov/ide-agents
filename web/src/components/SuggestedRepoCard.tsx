import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import type { KnownSkillRepo } from "../knownRepos";
import RepoUrlLine from "./RepoUrlLine";
import headerClasses from "./repoCardHeader.module.css";
import hoverClasses from "./repoCardHover.module.css";
import { useRepoCardOpen } from "./useRepoCardOpen";

export interface SuggestedRepoCardProps {
  repo: KnownSkillRepo;
  loading?: boolean;
  onAdd: () => void;
}

export default function SuggestedRepoCard({
  repo,
  loading,
  onAdd,
}: SuggestedRepoCardProps) {
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
              {repo.name}
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
            {repo.ref}
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
              <Text
                size="sm"
                c="dimmed"
                style={{ minWidth: 0, flex: 1, lineHeight: 1.45 }}
              >
                {repo.description}
              </Text>
              <Button
                variant="light"
                size="sm"
                disabled={loading}
                style={{ flexShrink: 0 }}
                onClick={onAdd}
              >
                Add / Clone
              </Button>
            </Group>
          </div>
        </div>
      </Stack>
    </Paper>
  );
}
