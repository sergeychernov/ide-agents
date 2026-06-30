# ide-agents

Local admin for **IDE agents and skills** from any git repository — **OpenCode**, **Cursor**, **Claude Code**, and **Codex** (enable in Settings).

Install skills and subagents into your IDE via symlinks — no copy-paste, no manual path juggling.

[![GitHub](https://img.shields.io/badge/GitHub-sergeychernov%2Fide--agents-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sergeychernov/ide-agents)
[![npm](https://img.shields.io/npm/v/ide-agents?style=for-the-badge&logo=npm&logoColor=white&label=npm)](https://www.npmjs.com/package/ide-agents)

## What it does

- Clones git repositories into `~/.ide-agents/repos/`
- Scans `skills/*/SKILL.md` and optional `agents/*.md`
- Creates symlinks in each enabled tool’s config directory and per-project folders
- Provides a browser UI: Settings, Repositories, Skills, Agents

**Not affiliated with Cursor.**

## Requirements

- **macOS** or **Linux** (Windows is not supported in v0.1)
- **Node.js 20+** — to run `ide-agents` (`npm i -g ide-agents` or `npm start`)
- **Node.js 20.19+** (or **22 LTS**) — to develop from source (`npm run dev`, `npm run build`; Vite 8 / Rolldown)
- **git** in PATH

## Install

```bash
npm i -g ide-agents
```

Or from source:

```bash
git clone https://github.com/sergeychernov/ide-agents.git
cd ide-agents
npm install
npm run build
npm i -g .
```

## Quick start

```bash
ide-agents
```

This will:

1. Create `~/.ide-agents/` on first run (migrates from `~/.agentdesk/` if present)
2. Start a local server at `http://127.0.0.1:3921` (or the next free port)
3. Open the UI in your browser

Press `Ctrl+C` to stop.

### CLI options

```bash
ide-agents --port 3922    # custom port
ide-agents --no-open      # do not open browser
```

## Settings

Open **Settings** (`/settings`) and enable the tools you use (OpenCode, Codex, Claude, Cursor). Set each **config path** (defaults: `~/.config/opencode`, `~/.codex`, `~/.claude`, `~/.cursor`).

On first run, a tool is enabled only if its default folder already exists in your home directory. You can change paths and toggles anytime; installs apply to all enabled tools.

## Add a repository

1. Open **Repositories** in the UI
2. Pick a suggested catalog or enter a git URL and branch (default `main`)
3. Click **Add / Clone**

Your repo should contain:

```
skills/
  my-skill/
    SKILL.md
agents/          # optional
  my-agent.md
```

For local testing, use a `file://` URL:

```
file:///Users/you/code/my-skills-repo
```

Private repos: configure SSH or `gh` auth yourself — ide-agents does not store tokens.

## Install artifacts

1. Go to **Skills** or **Agents**
2. Select a repository
3. Click **Global** (🌐) or **Project** (📁) on a card — symlinks apply immediately

| Tool     | Global (default config path) | Project subfolder |
|----------|------------------------------|-------------------|
| OpenCode | `~/.config/opencode/`        | `.opencode`       |
| Cursor   | `~/.cursor/`                 | `.cursor`         |
| Claude   | `~/.claude/`                 | `.claude`         |
| Codex    | `~/.codex/`                  | `.agents`         |

Global paths use your configured **config path** per tool. Project path is the directory where you started `ide-agents`.

Click the active icon again to remove the symlink (only if target is already a symlink).

## Development

```bash
npm install
npm run dev        # server on :3921 + Vite on :5173
npm run build      # compile server + web
npm start          # run production build
```

Documentation site (Docusaurus):

```bash
npm run docs:install
npm run docs:start # http://localhost:3000
```

For local testing, add a `file://` URL to any git repo with skills/agents (see [docs](https://ide-agents.vercel.app/docs/source-repos#local-testing)).

## Data layout

```
~/.ide-agents/
├── config.json     # repos, installations, ides (per-tool enable + paths)
└── repos/
    └── <slug>/     # git clone
```

Docs: [Settings & IDEs](https://ide-agents.vercel.app/docs/settings) on the project site.

## Troubleshooting

### `Cannot find native binding` / `@rolldown/binding-darwin-arm64`

Vite 8 uses Rolldown native binaries (optional npm deps). If `npm run dev` fails:

```bash
rm -rf node_modules package-lock.json
npm install
```

Ensure Node **20.19+** when developing from source (`node -v`). The repo ships `.npmrc` with `include=optional` and platform bindings in `optionalDependencies`.

## License

MIT
