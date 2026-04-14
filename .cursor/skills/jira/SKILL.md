---
name: create-jira-tasks
description: Create SNOLA issues (Stories, Bugs, Bug Critico) as children of PNOLA epics via the Atlassian MCP. Supports batch creation, developer assignment, squad tagging, and sprint placement. Use when the user mentions create task, create story, create bug, add jira issue, new jira task, SNOLA task, batch tasks, or creating issues on the board.
---

# Create Jira Tasks

Create SNOLA issues as children of PNOLA epics, with batch support, optional assignee, squad, and sprint placement.

## Constants

- **Cloud ID**: `f0f25379-97ec-409d-97f5-d85a246d6e35`
- **MCP server**: `project-0-Projects-Atlassian-MCP-Server`
- **PNOLA project**: epics only (issue type `Epic`, id `10000`)
- **SNOLA project**: stories, bugs, bug critico — children of PNOLA epics via the `parent` field
- **Jira browse URL**: `https://arcca.atlassian.net/browse/`
- **Squad field**: `customfield_10076` (values: `Squad 1`, `Squad 2`, `Squad 3`)
- **Sprint field**: `customfield_10020`
- **Link Design field**: `customfield_10071` (type: URL string)
- **Piloto field**: `customfield_10577` (type: text — pilot goal name, PNOLA epics only. E.g., `Automacao Financeira`)
- **Feature Flags field**: `customfield_10578` (type: text — flag key(s) the epic controls, PNOLA epics only. E.g., `open_finance_enabled`)

### Supported Issue Types (SNOLA)

| Jira Name | issueTypeName value | ID |
|-----------|--------------------|----|
| Historia (Story) | `História` | `10006` |
| Bug | `Bug` | `10009` |
| Bug Critico | `Bug Critico` | `10057` |

## Language

All task fields (summary, description, section headings) MUST be written in **Portuguese (pt-BR)**. Always compose content in Portuguese, even if the user provides input in English.

## Pre-flight: Verify MCP Connection

Before any Jira calls:

1. Check if `project-0-Projects-Atlassian-MCP-Server` is available.
2. If errored or needs authentication, call `mcp_auth` with empty arguments `{}` to re-authenticate.
3. If `mcp_auth` fails, instruct the user to restart the Atlassian MCP Server in Cursor Settings > MCP.
4. Only proceed once the server is confirmed active.

## Workflow

### Step 1: Gather input from the user

Ask (or infer from the message) the following. Use `AskQuestion` when available:

- **Epic**: existing PNOLA key (e.g. `PNOLA-106`) OR "new"
  - If new: epic summary and description (in Portuguese)
  - If new: **Piloto** (optional) — pilot goal name if this epic is part of a pilot. E.g., `Automacao Financeira`. All epics with the same Piloto value share pilot stores.
  - If new: **Feature Flags** (optional) — the flag/config key(s) this epic controls. E.g., `open_finance_enabled`. This links the epic to the store/brand config for pilot tracking.
- **Squad**: Squad 1, Squad 2, or Squad 3
- **Sprint**: backlog or current sprint
- **Link Design**: Figma URL (optional). If the user provides a Figma link as visual reference, store it in the `customfield_10071` (Link Design) field on each SNOLA issue.
- **Task list** (batch): for each task:
  - Issue type: Historia, Bug, or Bug Critico
  - Module name (for the `[Modulo]` prefix in the summary)
  - Short summary description
  - Description body (using the appropriate template — see below)
  - Assignee (optional, by display name)

If the user provides a bulk description or feature spec, break it down into individual stories following the granularity guidelines below.

### Step 2: Resolve or create the epic

**Existing epic** — validate it exists:

```
searchJiraIssuesUsingJql
  cloudId: f0f25379-97ec-409d-97f5-d85a246d6e35
  jql: key = {EPIC_KEY}
  fields: ["summary", "status"]
  maxResults: 1
```

If the epic does not exist, inform the user and stop.

**New epic** — create it on PNOLA:

```
createJiraIssue
  cloudId: f0f25379-97ec-409d-97f5-d85a246d6e35
  projectKey: PNOLA
  issueTypeName: Epic
  summary: {epic summary in Portuguese}
  description: {epic description in Portuguese}
  additional_fields: {
    "customfield_10577": "{PILOTO_VALUE}",         // Piloto goal name, only if provided
    "customfield_10578": "{FEATURE_FLAGS_VALUE}"   // Feature flag key(s), only if provided
  }
```

Omit `customfield_10577` and `customfield_10578` from `additional_fields` if the user did not provide them.

Store the returned key (e.g. `PNOLA-350`) for use as the parent.

### Step 3: Resolve assignees

For each unique assignee display name provided by the user:

```
lookupJiraAccountId
  cloudId: f0f25379-97ec-409d-97f5-d85a246d6e35
  query: {display name}
```

Cache the `accountId` results. If a name is used for multiple tasks, look it up only once. If lookup returns no match, warn the user and create the task unassigned.

### Step 4: Resolve sprint (if current sprint requested)

Skip this step if the user chose "backlog".

To find the active sprint ID:

```
searchJiraIssuesUsingJql
  cloudId: f0f25379-97ec-409d-97f5-d85a246d6e35
  jql: project = SNOLA AND sprint in openSprints()
  fields: ["summary", "customfield_10020"]
  maxResults: 1
```

Extract the sprint ID from the `customfield_10020` array in the response. Store it for Step 5.

If no open sprint is found, warn the user and create tasks in the backlog instead.

### Step 5: Create each SNOLA issue (batch)

For each task, call `createJiraIssue`:

```
createJiraIssue
  cloudId: f0f25379-97ec-409d-97f5-d85a246d6e35
  projectKey: SNOLA
  issueTypeName: {Historia | Bug | Bug Critico}
  summary: [{Modulo}] {Descricao curta}
  description: {filled template — see Description Templates below}
  parent: {PNOLA epic key}
  assignee_account_id: {resolved accountId, omit if unassigned}
  additional_fields: {
    "customfield_10076": { "value": "{Squad N}" },
    "customfield_10020": {SPRINT_ID},          // plain number, only if current sprint
    "customfield_10071": "{FIGMA_URL}"         // Link Design, only if provided
  }
```

Omit `customfield_10020` from `additional_fields` entirely when placing in backlog.

If any creation fails, log the error and continue with remaining tasks.

### Step 6: Report results

Present a summary table. Always hyperlink keys:

```
| # | Key | Type | Summary | Assignee | Status |
|---|-----|------|---------|----------|--------|
| 1 | [SNOLA-XXX](https://arcca.atlassian.net/browse/SNOLA-XXX) | Historia | [Modulo] Descricao | Dev Name | Created |
```

Include at the top:
- Epic: link to the PNOLA epic (new or existing)
- Squad and Sprint info
- Count of created vs failed

## Summary Format

All issues follow: `[Modulo] Descricao curta da tarefa`

Examples:
- `[CS] Modal na home da trilha de configuracao`
- `[CS] Marcar como concluida`
- `[Pagamentos] Validar dados do checkout`
- `[Reservas] Filtrar reservas por data`

## Description Templates

### Historia (Story)

```
Como {persona}, quero **{acao}**, para {objetivo}.

## Criterios de aceite
1. {Criterio 1}
   1. {Sub-criterio}
   2. {Sub-criterio}
2. {Criterio 2}
   1. {Sub-criterio}

## Casos de teste
1. {Caso de teste 1}
2. {Caso de teste 2}
```

### Bug / Bug Critico

```
## Comportamento atual
{O que esta acontecendo atualmente}

## Comportamento esperado
{O que deveria acontecer}
```

## Story Granularity Guidelines

When the user provides a broad feature description, break it down into small, focused stories. Each story should represent:

- A single screen or page
- A single user action (e.g. "marcar como concluida", "acessar configuracao")
- A single component or widget (e.g. "modal na home")
- A single toggle or setting

Reference: PNOLA-317 had 4 dev stories for a configuration checklist feature — one for the home modal, one for the list page, one for accessing a config, one for marking complete.

## Error Handling

- If `createJiraIssue` fails for a task, log the error and continue with remaining tasks.
- If `lookupJiraAccountId` returns no match, create the task unassigned and note it in the report.
- If no open sprint is found, fall back to backlog and warn the user.
- If the PNOLA epic key does not exist, stop and inform the user.
- If `searchJiraIssuesUsingJql` returns paginated results (`isLast: false`), fetch subsequent pages using `nextPageToken`.
