import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { CAPTURE_DIR } from './repo.mjs';

export function loadTour(tourPath, repoRoot) {
  const abs = isAbsolute(tourPath) ? tourPath : resolve(repoRoot, tourPath);
  let raw;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read tour file: ${abs} (${err.message})`);
  }
  let tour;
  try {
    tour = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in tour file: ${abs}`);
  }
  validateTour(tour, repoRoot, dirname(abs));
  return { tour, tourPath: abs };
}

function validateTour(tour, repoRoot, tourDir) {
  const errors = [];
  if (tour.version !== 1) {
    errors.push('tour.version must be 1');
  }
  if (!tour.baseURL || typeof tour.baseURL !== 'string') {
    errors.push('tour.baseURL (string) is required');
  }
  if (!Array.isArray(tour.pages) || tour.pages.length === 0) {
    errors.push('tour.pages must be a non-empty array');
  }
  for (const [i, page] of (tour.pages ?? []).entries()) {
    if (!page.id || typeof page.id !== 'string') {
      errors.push(`pages[${i}].id (string) is required`);
    }
    if (!page.path || typeof page.path !== 'string') {
      errors.push(`pages[${i}].path (string) is required`);
    }
  }
  if (tour.outputDir && typeof tour.outputDir !== 'string') {
    errors.push('tour.outputDir must be a string');
  }
  if (tour.server) {
    if (!tour.server.command || typeof tour.server.command !== 'string') {
      errors.push('tour.server.command (string) is required when server is set');
    }
    if (tour.server.cwd) {
      const cwd = isAbsolute(tour.server.cwd)
        ? tour.server.cwd
        : join(tourDir, tour.server.cwd);
      if (!cwd.startsWith(repoRoot)) {
        errors.push('tour.server.cwd must stay inside the repository');
      }
    }
  }
  if (errors.length) {
    throw new Error(`Tour validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}

export function resolveOutputDir(tour, repoRoot) {
  const rel = tour.outputDir ?? join(CAPTURE_DIR, 'screenshots');
  return isAbsolute(rel) ? rel : join(repoRoot, rel);
}
