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
    id: "repo-audit-skills",
    name: "sergeychernov/repo-audit-skills",
    url: "https://github.com/sergeychernov/repo-audit-skills.git",
    ref: "main",
    description:
      "Skills for repository audits — stack detection, architecture, code smells, security, and more.",
  },
  {
    id: "article-writing-kit",
    name: "sergeychernov/article-writing-kit",
    url: "https://github.com/sergeychernov/article-writing-kit.git",
    ref: "main",
    description:
      "Skills and agents for long-form article writing — Obsidian workspace setup, scaffolding, outlining, and editing.",
  },
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

export function isPrimaryKnownRepo(known: KnownSkillRepo): boolean {
  return known.id === KNOWN_SKILL_REPOS[0]?.id;
}

export function isKnownRepoInstalled(
  known: KnownSkillRepo,
  installedUrls: string[],
): boolean {
  const target = normalizeRepoUrl(known.url);
  return installedUrls.some((u) => normalizeRepoUrl(u) === target);
}
