---
name: hello
description: Demo skill — verifies ide-agents install and reads accurate local time via a bundled script.
scope: any
---

# Hello

Smoke-test skill that shows why **scripts beat chat** for deterministic output: the agent runs a bundled Node script that reads the **host system clock** (not model guesswork).

## Skill layout

```
skills/hello/
├── SKILL.md
└── scripts/
    └── now.mjs
```

## Quick start

```bash
node <SKILL_DIR>/scripts/now.mjs
node <SKILL_DIR>/scripts/now.mjs --json
```

Replace `<SKILL_DIR>` with the installed skill path (global or project symlink from ide-agents).

## Workflow

When the user invokes this skill or asks for a hello / time check:

1. Resolve `<SKILL_DIR>` (installed `hello` skill folder).
2. Run `node <SKILL_DIR>/scripts/now.mjs --json`.
3. Parse the JSON — fields `local`, `timeZone`, `utcOffset`, `iso`, `unixMs`.
4. Greet the user briefly and **quote the script output** as the authoritative local time.
5. Do not invent or approximate the time in prose; if the script fails, report the error.

## Agent instructions

- Prefer `--json` so the time is machine-parseable.
- Human summary example: “Hello — your system clock says … (timezone …).”
- This skill has no `assets/` folder; the script uses only Node stdlib and `Intl`.
