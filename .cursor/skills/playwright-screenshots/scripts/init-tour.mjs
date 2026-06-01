#!/usr/bin/env node
// playwright-screenshots: copy example tour into the target repo
//
// Usage (from anywhere inside a git repo):
//   node <SKILL_DIR>/scripts/init-tour.mjs
//   node <SKILL_DIR>/scripts/init-tour.mjs --json
//   node <SKILL_DIR>/scripts/init-tour.mjs --force

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { argv } from 'node:process';
import { capturePaths, findRepoRoot } from './lib/repo.mjs';
import { skillAssetsDir } from './lib/playwright.mjs';

const flags = new Set(argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2)));
const jsonOut = flags.has('json');
const force = flags.has('force');

const repoRoot = findRepoRoot();
const paths = capturePaths(repoRoot);
const example = join(skillAssetsDir(), 'tour.example.json');

mkdirSync(dirname(paths.tour), { recursive: true });

if (existsSync(paths.tour) && !force) {
  const msg = `Tour already exists: ${paths.tour} (use --force to overwrite)`;
  if (jsonOut) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: msg, tourPath: paths.tour }, null, 2)}\n`);
  } else {
    process.stderr.write(`${msg}\n`);
  }
  process.exit(1);
}

copyFileSync(example, paths.tour);

const payload = {
  ok: true,
  tourPath: paths.tour,
  message: 'Edit tour.json (baseURL, server, pages) then run capture.mjs',
};

if (jsonOut) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  process.stdout.write(`Created ${paths.tour}\n`);
  process.stdout.write('Next: edit pages, then node <SKILL_DIR>/scripts/capture.mjs --json\n');
}
