#!/usr/bin/env node
// playwright-screenshots: validate .docs-capture/tour.json
//
// Usage (from anywhere inside a git repo):
//   node <SKILL_DIR>/scripts/validate-tour.mjs
//   node <SKILL_DIR>/scripts/validate-tour.mjs --tour path/to/tour.json
//   node <SKILL_DIR>/scripts/validate-tour.mjs --json

import { argv } from 'node:process';
import { capturePaths, findRepoRoot } from './lib/repo.mjs';
import { loadTour } from './lib/tour.mjs';

const args = argv.slice(2);
const flags = new Set();
let tourPath;
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--tour') {
    tourPath = args[i + 1];
    if (!tourPath) {
      process.stderr.write('--tour requires a path\n');
      process.exit(1);
    }
    i += 1;
    continue;
  }
  if (a.startsWith('--')) flags.add(a.slice(2));
}
const jsonOut = flags.has('json');

const repoRoot = findRepoRoot();
const paths = capturePaths(repoRoot);
tourPath = tourPath ?? paths.tour;

try {
  const { tour, tourPath: abs } = loadTour(tourPath, repoRoot);
  const payload = {
    ok: true,
    tourPath: abs,
    pageCount: tour.pages.length,
    baseURL: tour.baseURL,
    hasServer: Boolean(tour.server),
  };
  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`OK: ${abs} (${tour.pages.length} pages, ${tour.baseURL})\n`);
  }
} catch (err) {
  if (jsonOut) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: err.message }, null, 2)}\n`);
  } else {
    process.stderr.write(`${err.message}\n`);
  }
  process.exit(1);
}
