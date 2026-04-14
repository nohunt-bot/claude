# Agents Guide

Agents are AI assistants with specific roles, tools, and behavioral rules. Think of them as "dedicated team members," each responsible for a different area of work.

## How to Create

Create a `.md` file in `.claude/agents/` with frontmatter configuration:

```markdown
---
name: code-reviewer
description: Reviews code quality, identifies potential issues and security vulnerabilities
tools: Read, Grep, Glob
model: sonnet
---

# Code Reviewer

You are a senior engineer specializing in code review.
Review focus:
- Readability and naming
- Security vulnerabilities (SQL injection, XSS, etc.)
- Performance issues
- Test coverage
```

## How to Invoke

1. **Auto-trigger**: Claude automatically delegates to the appropriate agent based on the task description
2. **Direct call**: Mention the agent name in conversation
3. **@mention**: Use `@code-reviewer` syntax to explicitly specify

## Model Selection

| Model | Use case |
|-------|---------|
| `haiku` | Lightweight tasks, frequent calls (cost savings) |
| `sonnet` | Main development work, complex tasks |
| `opus` | Architectural decisions, deep analysis |

## Example Agents

- `code-reviewer.md` — Code review
- `security-reviewer.md` — Security analysis
- `test-writer.md` — Writing tests
- `doc-writer.md` — Writing documentation
