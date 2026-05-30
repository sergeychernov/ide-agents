#!/usr/bin/env node
// hello: read the host system clock and print accurate local time
//
// Usage:
//   node <SKILL_DIR>/scripts/now.mjs
//   node <SKILL_DIR>/scripts/now.mjs --json

import process, { argv } from 'node:process';

const flags = new Set(
  argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2)),
);
const jsonOut = flags.has('json');

const now = new Date();
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const offsetMinutes = -now.getTimezoneOffset();

function formatUtcOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const mins = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${mins}`;
}

const payload = {
  source: 'system clock',
  unixMs: now.getTime(),
  unixSeconds: Math.floor(now.getTime() / 1000),
  iso: now.toISOString(),
  local: now.toLocaleString(undefined, {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'long',
  }),
  timeZone,
  utcOffset: formatUtcOffset(offsetMinutes),
  platform: process.platform,
};

if (jsonOut) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  process.stdout.write('Local time (system clock)\n');
  process.stdout.write(`  ${payload.local}\n`);
  process.stdout.write(`  ${payload.utcOffset} · ${payload.timeZone}\n`);
  process.stdout.write(`  ISO: ${payload.iso}\n`);
}
