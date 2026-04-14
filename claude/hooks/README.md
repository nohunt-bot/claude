# Hooks Guide

Hooks are Claude Code's automatic trigger mechanism — they execute corresponding actions
when specific events occur, without needing to remind Claude manually each time.

## Hook Event Types

| Event | When it fires |
|------|---------|
| `PreToolUse` | Before Claude executes a tool |
| `PostToolUse` | After Claude executes a tool |
| `SessionStart` | When a conversation starts |
| `Stop` | When a conversation ends |

## Configuration

Hooks are configured in `settings.json`, pointing to scripts in `.claude/hooks/`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "bash .claude/hooks/format.sh $FILE_PATH",
        "description": "Auto-format after edit"
      }
    ],
    "Stop": [
      {
        "command": "bash .claude/hooks/verify-build.sh",
        "description": "Verify build before conversation ends"
      }
    ]
  }
}
```

## Example Hook Scripts

### format.sh — Auto-format

```bash
#!/bin/bash
# .claude/hooks/format.sh
FILE=$1
if [[ $FILE == *.ts || $FILE == *.tsx ]]; then
  npx prettier --write "$FILE"
fi
```

### verify-build.sh — Verify build

```bash
#!/bin/bash
# .claude/hooks/verify-build.sh
echo "Verifying production build..."
npm run build
```

### lint.sh — Auto-lint

```bash
#!/bin/bash
# .claude/hooks/lint.sh
npx eslint --fix "$1"
```

## Recommended Order

1. format
2. lint
3. type-check
4. build verification (typically a Stop hook)
