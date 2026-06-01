export const GITHUB_STARS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

export interface StarCacheEntry {
  stars: number;
  fetchedAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function parseGitHubRepoUrl(url: string): GitHubRepoRef | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") {
      return null;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    const owner = segments[0]!;
    let repo = segments[1]!;
    if (repo.endsWith(".git")) {
      repo = repo.slice(0, -4);
    }
    if (!owner || !repo) {
      return null;
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

export function githubRepoWebUrl(ref: GitHubRepoRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}`;
}

export function githubStarsCacheKey(owner: string, repo: string): string {
  return `ide-agents:github-stars:${owner}/${repo}`;
}

export function readStarCache(
  storage: StorageLike,
  key: string,
  now = Date.now(),
): number | undefined {
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as StarCacheEntry;
    if (
      typeof parsed.fetchedAt !== "number" ||
      typeof parsed.stars !== "number"
    ) {
      return undefined;
    }
    if (now - parsed.fetchedAt >= GITHUB_STARS_CACHE_TTL_MS) {
      return undefined;
    }
    return parsed.stars;
  } catch {
    return undefined;
  }
}

export function writeStarCache(
  storage: StorageLike,
  key: string,
  stars: number,
  now = Date.now(),
): void {
  const entry: StarCacheEntry = { stars, fetchedAt: now };
  storage.setItem(key, JSON.stringify(entry));
}

export function formatStarCount(stars: number): string {
  if (stars >= 1_000_000) {
    const m = stars / 1_000_000;
    const text = m >= 10 ? Math.round(m).toString() : m.toFixed(1);
    return `${text.replace(/\.0$/, "")}M`;
  }
  if (stars >= 10_000) {
    const k = stars / 1_000;
    return `${Math.round(k)}k`;
  }
  if (stars >= 1_000) {
    const k = stars / 1_000;
    const text = k >= 10 ? Math.round(k).toString() : k.toFixed(1);
    return `${text.replace(/\.0$/, "")}k`;
  }
  return stars.toLocaleString("en-US");
}
