import { describe, expect, it, vi } from "vitest";
import {
  formatStarCount,
  GITHUB_STARS_CACHE_TTL_MS,
  githubStarsCacheKey,
  parseGitHubRepoUrl,
  readStarCache,
  writeStarCache,
  type StorageLike,
} from "./githubRepo.js";
import { fetchGitHubStars } from "./githubStars.js";

function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe("parseGitHubRepoUrl", () => {
  it("parses https github clone urls", () => {
    expect(
      parseGitHubRepoUrl(
        "https://github.com/sergeychernov/repo-audit-skills.git",
      ),
    ).toEqual({
      owner: "sergeychernov",
      repo: "repo-audit-skills",
    });
  });

  it("parses urls without .git suffix", () => {
    expect(parseGitHubRepoUrl("https://github.com/anthropics/skills")).toEqual({
      owner: "anthropics",
      repo: "skills",
    });
  });

  it("returns null for non-github hosts", () => {
    expect(parseGitHubRepoUrl("https://gitlab.com/org/repo.git")).toBeNull();
    expect(parseGitHubRepoUrl("file:///tmp/skills")).toBeNull();
  });
});

describe("formatStarCount", () => {
  it("formats compact counts", () => {
    expect(formatStarCount(42)).toBe("42");
    expect(formatStarCount(1500)).toBe("1.5k");
    expect(formatStarCount(12000)).toBe("12k");
    expect(formatStarCount(2_500_000)).toBe("2.5M");
  });
});

describe("github stars cache", () => {
  it("reads fresh cache and ignores expired entries", () => {
    const storage = createMemoryStorage();
    const key = githubStarsCacheKey("anthropics", "skills");
    const now = 1_000_000;
    writeStarCache(storage, key, 900, now);
    expect(readStarCache(storage, key, now)).toBe(900);
    expect(
      readStarCache(storage, key, now + GITHUB_STARS_CACHE_TTL_MS),
    ).toBeUndefined();
  });

  it("fetchGitHubStars uses cache without network", async () => {
    const storage = createMemoryStorage();
    const now = 5_000_000;
    writeStarCache(
      storage,
      githubStarsCacheKey("bluriesophos", "cursorskills"),
      321,
      now,
    );
    const fetchFn = vi.fn();
    const stars = await fetchGitHubStars(
      { owner: "bluriesophos", repo: "cursorskills" },
      { storage, fetchFn, now },
    );
    expect(stars).toBe(321);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fetchGitHubStars stores api response in cache", async () => {
    const storage = createMemoryStorage();
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 77 }),
    });
    const stars = await fetchGitHubStars(
      { owner: "anthropics", repo: "skills" },
      { storage, fetchFn, now: 9_000_000 },
    );
    expect(stars).toBe(77);
    expect(
      readStarCache(
        storage,
        githubStarsCacheKey("anthropics", "skills"),
        9_000_000,
      ),
    ).toBe(77);
  });
});
