# Commands Guide

Commands wrap common workflows into `/command-name` shortcuts,
so you don't have to repeat steps every time or miss important parts.

## How to Create

Create a `.md` file in `.claude/commands/` —
the filename becomes the command name (e.g. `explain-change.md` → `/explain-change`).

## Example: explain-change Command

File: `.claude/commands/explain-change.md`

```markdown
# Explain Change

Read the specified file $ARGUMENTS and output:

1. **Scope of change**: What does this file do
2. **Affected modules**: What else will be impacted
3. **Testing focus**: What scenarios need to be tested
```

Usage:
```
/explain-change src/cart.ts
```

## Example: review-pr Command

File: `.claude/commands/review-pr.md`

```markdown
# Review PR

Review the PR for $ARGUMENTS:

1. Read the diff
2. Check for security issues
3. Assess code quality
4. Provide specific suggestions
```

Usage:
```
/review-pr 123
```

## Using $ARGUMENTS

In the command content, use `$ARGUMENTS` to represent the user's input:

```
/my-command  whatever is typed here becomes $ARGUMENTS
```
