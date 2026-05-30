import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const IDE_AGENTS_GITIGNORE_HEADER =
  "# ide-agents (managed — do not edit manually)";

interface ParsedGitignore {
  before: string;
  entries: string[];
  after: string;
}

export function toGitignorePath(
  projectRoot: string,
  targetPath: string,
): string | null {
  const relative = path.relative(
    path.resolve(projectRoot),
    path.resolve(targetPath),
  );
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return relative.split(path.sep).join("/");
}

export async function isGitRepository(projectRoot: string): Promise<boolean> {
  try {
    await access(path.join(projectRoot, ".git"));
    return true;
  } catch {
    return false;
  }
}

function parseGitignore(content: string): ParsedGitignore {
  const lines = content.split("\n");
  const headerIndex = lines.findIndex(
    (line) => line.trim() === IDE_AGENTS_GITIGNORE_HEADER,
  );

  if (headerIndex === -1) {
    return { before: content.replace(/\n?$/, ""), entries: [], after: "" };
  }

  const before = lines.slice(0, headerIndex).join("\n").replace(/\n?$/, "");
  const entries: string[] = [];
  let index = headerIndex + 1;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === "") {
      index += 1;
      break;
    }
    if (trimmed.startsWith("#")) {
      break;
    }
    entries.push(line);
    index += 1;
  }

  const after = lines.slice(index).join("\n").replace(/^\n?/, "");
  return { before, entries, after };
}

function formatGitignore(parsed: ParsedGitignore): string {
  const parts: string[] = [];

  if (parsed.before.length > 0) {
    parts.push(parsed.before);
  }

  if (parsed.entries.length > 0) {
    parts.push(IDE_AGENTS_GITIGNORE_HEADER);
    parts.push(...parsed.entries);
    parts.push("");
  }

  if (parsed.after.length > 0) {
    parts.push(parsed.after.replace(/\n?$/, ""));
  }

  if (parts.length === 0) {
    return "";
  }

  return `${parts.join("\n")}\n`;
}

async function readGitignore(gitignorePath: string): Promise<string> {
  try {
    return await readFile(gitignorePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw err;
  }
}

async function writeGitignoreIfChanged(
  gitignorePath: string,
  nextContent: string,
): Promise<void> {
  const current = await readGitignore(gitignorePath);
  if (current === nextContent) {
    return;
  }

  await writeFile(gitignorePath, nextContent, "utf8");
}

export async function addManagedGitignoreEntry(
  projectRoot: string,
  entry: string,
): Promise<void> {
  if (!(await isGitRepository(projectRoot))) {
    return;
  }

  const gitignorePath = path.join(projectRoot, ".gitignore");
  const parsed = parseGitignore(await readGitignore(gitignorePath));

  if (parsed.entries.includes(entry)) {
    return;
  }

  parsed.entries.push(entry);
  parsed.entries.sort((a, b) => a.localeCompare(b));
  await writeGitignoreIfChanged(gitignorePath, formatGitignore(parsed));
}

export async function removeManagedGitignoreEntry(
  projectRoot: string,
  entry: string,
): Promise<void> {
  if (!(await isGitRepository(projectRoot))) {
    return;
  }

  const gitignorePath = path.join(projectRoot, ".gitignore");
  const parsed = parseGitignore(await readGitignore(gitignorePath));

  if (!parsed.entries.includes(entry)) {
    return;
  }

  parsed.entries = parsed.entries.filter((line) => line !== entry);
  await writeGitignoreIfChanged(gitignorePath, formatGitignore(parsed));
}
