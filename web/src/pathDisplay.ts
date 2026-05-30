export function toDisplayPath(absolutePath: string, homePrefix: string): string {
  const normalized = absolutePath.replace(/\/$/, "");
  const home = homePrefix.replace(/\/$/, "");
  if (normalized === home) {
    return "~";
  }
  if (normalized.startsWith(`${home}/`)) {
    return `~${normalized.slice(home.length)}`;
  }
  return absolutePath;
}
