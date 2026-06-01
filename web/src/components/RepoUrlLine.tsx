import { Anchor, Badge } from "@mantine/core";
import { IconBrandGithub, IconStar } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { fetchGitHubStars } from "../githubStars.js";
import {
  formatStarCount,
  githubRepoWebUrl,
  parseGitHubRepoUrl,
} from "../githubRepo.js";

export interface RepoUrlLineProps {
  url: string;
}

export default function RepoUrlLine({ url }: RepoUrlLineProps) {
  const github = parseGitHubRepoUrl(url);
  const [stars, setStars] = useState<number | null | "loading">(
    github ? "loading" : null,
  );

  useEffect(() => {
    const ref = parseGitHubRepoUrl(url);
    if (!ref) {
      return;
    }
    let cancelled = false;
    setStars("loading");
    void fetchGitHubStars(ref).then((count) => {
      if (!cancelled) {
        setStars(count);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (github) {
    const href = githubRepoWebUrl(github);
    const starLabel =
      stars === "loading"
        ? null
        : stars !== null
          ? formatStarCount(stars)
          : null;

    return (
      <Anchor
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        underline="never"
        onClick={(e) => e.stopPropagation()}
      >
        <Badge
          variant="light"
          color="gray"
          size="sm"
          leftSection={<IconBrandGithub size={14} />}
          rightSection={
            starLabel ? <IconStar size={12} stroke={1.5} /> : undefined
          }
        >
          {starLabel ? `GitHub · ${starLabel}` : "GitHub"}
        </Badge>
      </Anchor>
    );
  }

  return (
    <Anchor
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      size="xs"
      c="dimmed"
      style={{ wordBreak: "break-all" }}
      onClick={(e) => e.stopPropagation()}
    >
      {url}
    </Anchor>
  );
}
