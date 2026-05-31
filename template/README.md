# Skills & agents catalog

A git repository of **IDE skills** and **agents** for Cursor, Claude Code, and Codex.

Managed with [ide-agents](https://github.com/sergeychernov/ide-agents) — clone this repo in the UI, then install artifacts globally or per project.

## Layout

```
.
├── skills/
│   └── <skill-id>/
│       ├── SKILL.md          # required — frontmatter: name, description, scope
│       ├── scripts/          # optional — *.mjs generators (see .cursor/rules/scripts.mdc)
│       └── assets/           # optional — JSON/markers for scripts
├── agents/
│   └── <agent-id>.md         # orchestrators — call scripts, not inline generators
├── .cursor/rules/            # Cursor project rules (repo structure)
├── .claude/CLAUDE.md         # Claude Code project instructions
└── .agents/AGENTS.md         # Codex project instructions
```

## SKILL.md frontmatter

```yaml
---
name: my-skill
description: What this skill does.
scope: any   # global | project | any
---
```

## Agents

Agent files live in `agents/<agent-id>.md`. YAML frontmatter:

```yaml
---
name: my-agent
description: When the IDE should delegate to this subagent.
scope: any   # global | project | any — ide-agents install toggles only
skills:      # optional — dependent skill ids (block list)
  - related-skill
---
```

`skills` lists skill ids the agent orchestrates or depends on. ide-agents installs them
together with the agent and blocks removing a skill while a dependent agent stays
installed. Standalone agents omit `skills`; do not use inline arrays such as
`skills: []` or `skills: [related-skill]`.

`name` must match the filename stem (`agents/oracle.md` → `name: oracle`). Subagents install to `~/.cursor/agents/<name>.md` (or project `.cursor/agents/`); invoke in Agent mode by name, not via the `/` skill menu.

## Sample artifacts

This repo was bootstrapped with a demo skill and a starter agent. Extend or replace them as you build your catalog.

| Kind | ID | Purpose |
|------|-----|---------|
| skill | `hello` | Install smoke-test + `scripts/now.mjs` (system clock) |
| agent | `oracle` | Joke fortune-teller — depends on `hello` for optional clock anchor |

## Next steps

1. Edit or add skills under `skills/` and agents under `agents/`.
2. Commit and push to your remote.
3. In ide-agents, open **Skills** / **Agents** and toggle **Global** or **Project** to symlink into your IDE.
