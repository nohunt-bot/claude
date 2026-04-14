# Rules Guide

Rules are guidelines that tell Claude how to write code, what to avoid, and what standards to follow.

## Key Advantage: Path-Conditional Loading

Rules support a `paths` frontmatter field — they only load when working on matching files,
preventing unrelated rules from consuming context and keeping large projects efficient.

## How to Create

Create `.md` files in `.claude/rules/`:

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API Development Standards

- Follow RESTful conventions: GET /users, POST /users
- Unified response format: `{ success: true, data: {...} }`
- All endpoints must validate tokens
- Use parameterized queries — no string-concatenated SQL
```

## Example Rule Files

### api-standards.md

```markdown
---
paths:
  - "src/api/**"
  - "src/routes/**"
---
# API Standards
- RESTful endpoint naming
- Unified error format
- Rate limiting must be enabled
```

### frontend-standards.md

```markdown
---
paths:
  - "src/components/**"
  - "src/pages/**"
---
# Frontend Standards
- Use semantic HTML
- Animate only with transform / opacity
- Avoid inline styles
```

### database-standards.md

```markdown
---
paths:
  - "src/db/**"
  - "migrations/**"
---
# Database Standards
- All queries must use parameterized queries
- Migrations require a rollback script
- Never use bare SELECT *
```

## CLAUDE.md vs rules/

| | CLAUDE.md | rules/ |
|--|-----------|--------|
| When loaded | Every conversation | Only when paths match |
| Best for | Universal project-wide basics | Detailed domain-specific standards |
| Ideal size | Concise | Can be more detailed |
