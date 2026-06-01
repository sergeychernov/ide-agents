---
name: playwright-screenshots
description: >-
  Captures deterministic UI screenshots with Playwright from a tour manifest:
  optional dev-server boot, static pages via CLI, interactive flows via generated
  tests. Writes .docs-capture/manifest.json for downstream doc agents. Use when
  documenting UIs, refreshing Docusaurus images, or the user asks for Playwright
  screenshots of a running app — not for writing prose or MDX.
---

# Playwright screenshots

**Project skill** (this repo only: `.cursor/skills/playwright-screenshots/`). Screenshots only — no Docusaurus MDX. Delegate prose to **`docusaurus-scribe`** (`.cursor/agents/docusaurus-scribe.md`).

Deterministic work lives in `scripts/`; `<SKILL_DIR>` = this directory (repo root `.cursor/skills/playwright-screenshots`). Run scripts with `--json`; read `.docs-capture/manifest.json` in the repo working tree.

## Layout

```
skills/playwright-screenshots/
├── SKILL.md
├── assets/
│   ├── tour.example.json
│   └── playwright.capture.config.mjs
└── scripts/
    ├── init-tour.mjs
    ├── validate-tour.mjs
    ├── capture.mjs
    └── lib/
```

## Target repo contract

| Path | Purpose |
|------|---------|
| `.docs-capture/tour.json` | Tour manifest (URLs, server, pages, output dir) |
| `.docs-capture/manifest.json` | **Output** — screenshot index for doc agents |
| `.docs-capture/run.capture.spec.mjs` | Generated when pages use `actions` |
| `tour.outputDir` (e.g. `docs/static/img/ui`) | PNG files |

**Prerequisites** in the project under documentation:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

## Quick start

```bash
node <SKILL_DIR>/scripts/init-tour.mjs
# edit .docs-capture/tour.json (baseURL, server.command, pages)

node <SKILL_DIR>/scripts/validate-tour.mjs --json
node <SKILL_DIR>/scripts/capture.mjs --json
```

If the app is already running: set `server` to `null` or run `capture.mjs --no-server`.

## Scripts

| Script | Role |
|--------|------|
| `init-tour.mjs` | Copy `assets/tour.example.json` → `.docs-capture/tour.json` |
| `validate-tour.mjs` | Validate tour JSON (no browser) |
| `capture.mjs` | Start server (optional), capture PNGs, write manifest |

Standard flags: `--json`, `--dry-run`, `--force` (init-tour overwrite).

## Tour manifest

- `baseURL` — origin of the running app
- `server` (optional) — `{ command, cwd?, readyUrl?, readyTimeoutMs? }`
- `outputDir` — relative to repo root (default `.docs-capture/screenshots`)
- `pages[]` — `{ id, path, title?, fullPage?, actions? }`

**Static page** (no `actions`): `npx playwright screenshot <url> <file>`.

**Interactive page** (`actions`): generates `run.capture.spec.mjs` and runs `npx playwright test`.

Supported actions: `waitForSelector`, `click`, `fill` (object), `press`, `waitMs`.

## Agent instructions

When this skill is invoked **alone**:

1. Resolve `<SKILL_DIR>` (installed `playwright-screenshots` folder).
2. If `.docs-capture/tour.json` is missing → `init-tour.mjs --json`.
3. `validate-tour.mjs --json` — stop on error.
4. `capture.mjs --json` — parse manifest path and `screenshots[]`.
5. Report file paths only; do not invent screenshot URLs or regenerate PNGs in chat.

When invoked **by `docusaurus-scribe`**: run steps 2–4, return manifest JSON; do not author MDX.

## Git (maintain docs over time)

**Commit** in the target repo:

| Path | Why |
|------|-----|
| `.docs-capture/tour.json` | Source of truth — which URLs and pages to capture |
| `.docs-capture/manifest.json` | Last capture index (`id` → `file`) for agents updating MDX without re-guessing paths |
| `docs/static/img/ui/*.png` (or `tour.outputDir`) | Assets referenced by the site |

**Do not commit** (regenerated): `.docs-capture/run.capture.spec.mjs`. Optional: `playwright.config.mjs` (copied from skill assets on first run).

Re-run `capture.mjs` after UI changes, then commit updated PNGs + manifest.

## Do not

- Write or edit `docs/**/*.mdx` from this skill
- Guess UI state — extend `tour.json` and re-run `capture.mjs`
