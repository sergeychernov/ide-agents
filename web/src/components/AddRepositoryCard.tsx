import { FormEvent } from "react";
import {
  Box,
  Button,
  Group,
  Paper,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";

export interface AddRepositoryCardProps {
  url: string;
  ref: string;
  loading?: boolean;
  onUrlChange: (url: string) => void;
  onRefChange: (ref: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export default function AddRepositoryCard({
  url,
  ref,
  loading,
  onUrlChange,
  onRefChange,
  onSubmit,
}: AddRepositoryCardProps) {
  return (
    <Paper withBorder p="sm" radius="md">
      <form onSubmit={onSubmit}>
        <Stack gap="sm">
          <Title order={5}>Custom repository</Title>
          <Group align="flex-end" gap="sm" wrap="wrap">
            <Box style={{ flex: "1 1 12rem", minWidth: "min(100%, 12rem)" }}>
              <TextInput
                size="sm"
                label="Git URL"
                placeholder="https://github.com/org/skills.git or file:///path/to/repo"
                value={url}
                onChange={(e) => onUrlChange(e.currentTarget.value)}
                required
              />
            </Box>
            <Box w={{ base: "100%", sm: "8.75rem" }} style={{ flex: "0 0 auto" }}>
              <TextInput
                size="sm"
                label="Ref (branch/tag)"
                value={ref}
                onChange={(e) => onRefChange(e.currentTarget.value)}
              />
            </Box>
            <Button
              type="submit"
              size="sm"
              loading={loading}
              w={{ base: "100%", sm: "auto" }}
              style={{ flex: "0 0 auto" }}
            >
              Add / Clone
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
