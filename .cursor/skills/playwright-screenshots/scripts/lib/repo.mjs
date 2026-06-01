import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function findRepoRoot(startDir = process.cwd()) {
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      cwd: startDir,
    }).trim();
    if (!existsSync(join(root, '.git'))) {
      throw new Error('not a git repository');
    }
    return root;
  } catch {
    throw new Error(
      'Not inside a git repository. Run from your project root (git rev-parse failed).',
    );
  }
}

export const CAPTURE_DIR = '.docs-capture';

export function capturePaths(repoRoot) {
  const dir = join(repoRoot, CAPTURE_DIR);
  return {
    dir,
    tour: join(dir, 'tour.json'),
    manifest: join(dir, 'manifest.json'),
    runnerSpec: join(dir, 'run.capture.spec.mjs'),
    playwrightConfig: join(dir, 'playwright.config.mjs'),
  };
}
