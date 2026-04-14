# Skills Guide

Skills are reusable "playbooks" — Claude automatically reads the relevant content when
executing related tasks, and doesn't load them otherwise, avoiding wasted tokens.

## Folder Structure

Each skill is an independent folder containing:

```
.claude/skills/
├── deploy/
│   ├── SKILL.md          # Main config (required)
│   ├── checklist.md      # Supporting docs (optional)
│   └── examples/         # Examples (optional)
├── database-migration/
│   ├── SKILL.md
│   └── rollback-template.sql
└── api-testing/
    ├── SKILL.md
    └── test-examples.http
```

## SKILL.md Format

```markdown
---
name: deploy
description: Complete workflow for deploying to production
triggers:
  - deploy
  - production
---

# Deployment Workflow

## Pre-deploy checklist
- [ ] All tests passing
- [ ] CHANGELOG updated
- [ ] Version bumped

## Deploy steps
1. `npm run build`
2. `npm run test:e2e`
3. `git tag v{version}`
4. Notify the team

## Post-deploy verification
- Confirm health checks pass
- Monitor error rate for 15 minutes
```

## Useful Skill Examples

| Skill | When it triggers |
|-------|----------------|
| `deploy/` | Deploy, release-related tasks |
| `code-review/` | Reviewing PRs, checking code |
| `database-migration/` | Database changes, migrations |
| `api-testing/` | Testing APIs, creating test cases |
| `incident-response/` | Handling production issues, incidents |

## Skills vs Commands

| | Skills | Commands |
|--|--------|---------|
| How triggered | Automatic (based on task content) | Manual (`/command-name`) |
| Best for | Deep knowledge, process playbooks | Repetitive workflow shortcuts |
| Structure | Folder + SKILL.md | Single `.md` file |
