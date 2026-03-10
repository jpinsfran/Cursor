---
name: create-skill-optimized
description: Creates new Cursor Agent Skills in an optimized way: minimal requirements, clear structure, and quality checks. Use when the user wants to create a new skill, author a SKILL.md, or set up a .cursor/skills/ workflow.
---

# Create Skill (Optimized)

Use this workflow to create new skills with minimal back-and-forth and maximum quality.

## 1. Quick discovery (minimal)

Ask only what’s needed:

- **Purpose**: One sentence — what does this skill do?
- **Location**: Project (`.cursor/skills/`) or personal (`~/.cursor/skills/`). Default: project.
- **Triggers**: When should the agent use it? (keywords/phrases)

If the user already described the skill, infer and confirm only gaps.

## 2. Design

**Name**: lowercase, hyphens, &lt; 64 chars (e.g. `process-pdfs`, `git-commit-helper`).

**Description** (critical for discovery):

- Third person only. No “I” or “You can use this”.
- Include **what** (capabilities) and **when** (trigger scenarios).
- Add concrete trigger terms so the agent can match user intent.

```yaml
# Good
description: Extract text and tables from PDFs, fill forms. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# Bad
description: Helps with documents.
```

## 3. Structure

Create:

```
skill-name/
└── SKILL.md    # required
```

Optional only when needed: `reference.md`, `examples.md`, or `scripts/`. Prefer a single SKILL.md under ~500 lines.

**SKILL.md template:**

```markdown
---
name: skill-name
description: [Third-person, specific, WHAT + WHEN and trigger terms]
---

# [Title]

## When to use
[Bullet list of trigger scenarios]

## Instructions
[Step-by-step; concise; assume the agent is capable]

## [Optional] Examples / Checklist / Template
[Only if it improves correctness or consistency]
```

## 4. Writing rules

- **Concise**: Add only what the agent doesn’t already know. No long intros or repeated explanations.
- **One level of links**: From SKILL.md → `reference.md` or `examples.md` only. No deep nesting.
- **Paths**: Use forward slashes (e.g. `scripts/helper.py`), not backslashes.
- **One default**: Prefer one clear approach; mention alternatives only when necessary (e.g. “For OCR, use X instead”).

Avoid: vague names (`helper`, `utils`), time-sensitive rules (“before August 2025”), and multiple equivalent options without a default.

## 5. Before finishing

- [ ] Description is third person, specific, with trigger terms
- [ ] SKILL.md under 500 lines
- [ ] File references are one level deep
- [ ] Terminology consistent in the file

Then create the directory and write `SKILL.md` (and any optional files). Do not create skills under `~/.cursor/skills-cursor/`.
