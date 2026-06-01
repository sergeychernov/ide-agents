import {
  githubStarsCacheKey,
  readStarCache,
  writeStarCache,
  type GitHubRepoRef,
  type StorageLike,
} from "./githubRepo.js";

export async function fetchGitHubStars(
  ref: GitHubRepoRef,
  options?: {
    storage?: StorageLike | null;
    fetchFn?: typeof fetch;
    now?: number;
  },
): Promise<number | null> {
  const storage =
    options?.storage ??
    (typeof localStorage !== "undefined" ? localStorage : null);
  const key = githubStarsCacheKey(ref.owner, ref.repo);
  const now = options?.now ?? Date.now();

  if (storage) {
    const cached = readStarCache(storage, key, now);
    if (cached !== undefined) {
      return cached;
    }
  }

  const fetchFn = options?.fetchFn ?? fetch;
  try {
    const res = await fetchFn(
      `https://api.github.com/repos/${ref.owner}/${ref.repo}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { stargazers_count?: unknown };
    const stars =
      typeof data.stargazers_count === "number" ? data.stargazers_count : null;
    if (storage && stars !== null) {
      writeStarCache(storage, key, stars, now);
    }
    return stars;
  } catch {
    return null;
  }
}
