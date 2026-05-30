export interface KnownSkillRepo {
  id: string;
  name: string;
  url: string;
  ref: string;
  description: string;
}

/** Public catalogs compatible with ide-agents skill scanning. */
export const KNOWN_SKILL_REPOS: KnownSkillRepo[] = [
  {
    id: "anthropics-skills",
    name: "anthropics/skills",
    url: "https://github.com/anthropics/skills.git",
    ref: "main",
    description:
      "Reference Agent Skills from Anthropic — documents, PDF, spreadsheets, design, and more.",
  },
  {
    id: "cursorskills",
    name: "bluriesophos/cursorskills",
    url: "https://github.com/bluriesophos/cursorskills.git",
    ref: "main",
    description:
      "Cursor workflow skills — planning, debugging, code review, scope discipline, verification.",
  },
];

export function normalizeRepoUrl(url: string): string {
  return url.trim().replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
}

export function isKnownRepoInstalled(
  known: KnownSkillRepo,
  installedUrls: string[],
): boolean {
  const target = normalizeRepoUrl(known.url);
  return installedUrls.some((u) => normalizeRepoUrl(u) === target);
}
