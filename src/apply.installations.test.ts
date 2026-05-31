import { describe, expect, it } from "vitest";
import { findRemovedInstallations } from "./apply.js";
import type { Installation } from "./types.js";

function inst(
  kind: Installation["kind"],
  artifactId: string,
  repoId = "repo",
): Installation {
  return {
    id: `${kind}-${artifactId}`,
    repoId,
    kind,
    artifactId,
    sourcePath: kind === "skill" ? `skills/${artifactId}` : `agents/${artifactId}.md`,
    targetName: artifactId,
    global: true,
    project: false,
    projectPath: null,
  };
}

describe("findRemovedInstallations", () => {
  it("treats skill and agent with same artifactId as distinct", () => {
    const previous = [
      inst("skill", "article-architect"),
      inst("agent", "article-architect"),
      inst("agent", "oracle"),
    ];
    const next = [inst("skill", "article-architect"), inst("agent", "oracle")];

    const removed = findRemovedInstallations(previous, next);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.kind).toBe("agent");
    expect(removed[0]?.artifactId).toBe("article-architect");
  });

  it("detects removed skill without removing agent with same id", () => {
    const previous = [
      inst("skill", "article-architect"),
      inst("agent", "article-architect"),
    ];
    const next = [inst("agent", "article-architect")];

    const removed = findRemovedInstallations(previous, next);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.kind).toBe("skill");
  });
});
