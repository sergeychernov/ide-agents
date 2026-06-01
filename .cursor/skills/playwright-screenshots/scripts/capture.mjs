#!/usr/bin/env node
// playwright-screenshots: start app (optional), capture UI screenshots, write manifest
//
// Usage (from anywhere inside a git repo):
//   node <SKILL_DIR>/scripts/capture.mjs
//   node <SKILL_DIR>/scripts/capture.mjs --json
//   node <SKILL_DIR>/scripts/capture.mjs --dry-run
//   node <SKILL_DIR>/scripts/capture.mjs --tour .docs-capture/tour.json
//   node <SKILL_DIR>/scripts/capture.mjs --no-server
//
// Prerequisites in target repo:
//   npm install -D @playwright/test && npx playwright install chromium

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { argv } from 'node:process';
import { capturePaths, findRepoRoot } from './lib/repo.mjs';
import { loadTour, resolveOutputDir } from './lib/tour.mjs';
import { startDevServer } from './lib/server.mjs';
import {
  assertPlaywrightInstalled,
  ensureCapturePlaywrightConfig,
  runCaptureTests,
  screenshotUrl,
  skillAssetsDir,
  stampManifest,
  writeCaptureSpec,
} from './lib/playwright.mjs';

const args = argv.slice(2);
const flags = new Set();
let tourPathArg;
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--tour') {
    tourPathArg = args[i + 1];
    if (!tourPathArg) {
      process.stderr.write('--tour requires a path\n');
      process.exit(1);
    }
    i += 1;
    continue;
  }
  if (a.startsWith('--')) flags.add(a.slice(2));
}
const jsonOut = flags.has('json');
const dryRun = flags.has('dry-run');
const noServer = flags.has('no-server');

const repoRoot = findRepoRoot();
process.chdir(repoRoot);
const paths = capturePaths(repoRoot);
const tourPath = tourPathArg ?? paths.tour;

const { tour } = loadTour(tourPath, repoRoot);
const outputDirAbs = resolveOutputDir(tour, repoRoot);
const viewport = tour.viewport ?? { width: 1280, height: 720 };

const staticPages = [];
const interactivePages = [];

for (const page of tour.pages) {
  const relOut = join(
    relative(repoRoot, outputDirAbs),
    `${page.id}.png`,
  ).replace(/\\/g, '/');
  const outAbs = join(repoRoot, relOut);
  const entry = { ...page, _outPath: outAbs, _relPath: relOut };
  if (page.actions?.length) {
    interactivePages.push(entry);
  } else {
    staticPages.push(entry);
  }
}

if (dryRun) {
  const payload = {
    ok: true,
    dryRun: true,
    repoRoot,
    tourPath,
    baseURL: tour.baseURL,
    outputDir: relative(repoRoot, outputDirAbs).replace(/\\/g, '/'),
    staticCount: staticPages.length,
    interactiveCount: interactivePages.length,
    pages: tour.pages.map((p) => ({ id: p.id, path: p.path })),
  };
  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Dry run: would capture ${tour.pages.length} page(s) → ${payload.outputDir}\n`);
  }
  process.exit(0);
}

assertPlaywrightInstalled(repoRoot);
mkdirSync(paths.dir, { recursive: true });
mkdirSync(outputDirAbs, { recursive: true });
ensureCapturePlaywrightConfig(paths.dir, skillAssetsDir(), tour.baseURL, viewport);

let stopServer = () => {};
if (tour.server && !noServer) {
  const started = await startDevServer(tour.server, repoRoot);
  stopServer = started.kill;
}

const shots = [];

try {
  for (const page of staticPages) {
    const url = new URL(page.path, tour.baseURL).href;
    screenshotUrl(repoRoot, url, page._outPath, {
      fullPage: page.fullPage !== false,
      viewport,
    });
    shots.push({
      id: page.id,
      title: page.title ?? page.id,
      path: page.path,
      file: page._relPath,
      url,
      mode: 'cli',
    });
  }

  if (interactivePages.length > 0) {
    writeCaptureSpec(paths.runnerSpec, interactivePages, tour.baseURL);
    runCaptureTests(repoRoot, paths.dir, tour.baseURL);
    for (const page of interactivePages) {
      shots.push({
        id: page.id,
        title: page.title ?? page.id,
        path: page.path,
        file: page._relPath,
        url: new URL(page.path, tour.baseURL).href,
        mode: 'test',
      });
    }
  }

  const manifest = stampManifest({
    repoRoot,
    tourPath: relative(repoRoot, tourPath).replace(/\\/g, '/'),
    baseURL: tour.baseURL,
    outputDir: relative(repoRoot, outputDirAbs).replace(/\\/g, '/'),
    screenshots: shots,
  });

  writeFileSync(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const payload = { ok: true, manifestPath: paths.manifest, screenshotCount: shots.length, screenshots: shots };
  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Captured ${shots.length} screenshot(s)\n`);
    process.stdout.write(`Manifest: ${paths.manifest}\n`);
    for (const s of shots) {
      process.stdout.write(`  ${s.id} → ${s.file}\n`);
    }
  }
} finally {
  stopServer();
}
