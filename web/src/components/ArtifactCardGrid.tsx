import { Box } from "@mantine/core";
import type { ReactNode } from "react";

const CARD_MAX_WIDTH = 480;

export default function ArtifactCardGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${CARD_MAX_WIDTH}px), ${CARD_MAX_WIDTH}px))`,
        gap: "var(--mantine-spacing-md)",
      }}
    >
      {children}
    </Box>
  );
}
