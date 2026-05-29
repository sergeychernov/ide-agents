# npm publish

Package: **`ide-agents`** · CLI: **`ide-agents`** · Data: **`~/.ide-agents/`**

Legacy `~/.agentdesk/` is migrated automatically on first run.

## Check name

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://registry.npmjs.org/ide-agents
# expect 404 before first publish
```

## Publish

```bash
npm login
npm run build
npm pack --dry-run
npm publish --access public
```

## Install

```bash
npm i -g ide-agents
ide-agents
```
