# ide-agents

Local admin for **IDE agents and skills** (Cursor and similar) from any git repository.

Install skills and subagents into your IDE via symlinks — no copy-paste, no manual path juggling.

## What it does

- Clones git repositories into `~/.ide-agents/repos/`
- Scans `skills/*/SKILL.md` and optional `agents/*.md`
- Creates symlinks in `~/.cursor/` (global) or `<project>/.cursor/` (per-project)
- Provides a browser UI for repos, skills, and agents

**Not affiliated with Cursor.**

## Requirements

- **macOS** or **Linux** (Windows is not supported in v0.1)
- **Node.js 20+**
- **git** in PATH

## Install

```bash
npm i -g ide-agents
```

Or from source:

```bash
git clone https://github.com/sergeychernov/agentdesk.git
cd agentdesk
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

## Add a repository

1. Open **Settings** in the UI
2. Enter a git URL and branch (default `main`)
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

| Kind  | Global                         | Project                              |
|-------|--------------------------------|--------------------------------------|
| Skill | `~/.cursor/skills/<name>`      | `<project>/.cursor/skills/<name>`    |
| Agent | `~/.cursor/agents/<name>.md`   | `<project>/.cursor/agents/<name>.md` |

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

Fixture repo for manual testing:

```bash
cd fixtures/sample-repo && git init && git add . && git commit -m "init"
```

Then add `file://$(pwd)` in the UI.

## Data layout

```
~/.ide-agents/
├── config.json
└── repos/
    └── <slug>/     # git clone
```

## License

MIT
