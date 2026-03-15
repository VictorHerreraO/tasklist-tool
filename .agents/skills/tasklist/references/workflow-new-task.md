# New Task Creation Workflow

**Version:** 0.2.0

---

## Trigger Conditions

This workflow applies when:
- The user asks to create a task, project, or subtask
- A task breakdown is requested (decomposing a large task into subtasks)

Regardless of trigger, complete all phases below before reporting the task as created.

---

## Phase 1 — Task Understanding

Before creating anything, confirm you can clearly answer:
1. **Task subject** — What is the task about? (domain, goal, scope)
2. **User expectation of you** — What does the user want the agent to do?
3. **User expectation of the task** — What outcome or deliverable is expected?

If any criterion is unclear, ask the user for clarification conversationally — one or two targeted questions at a time, not a big list. Do not guess or infer missing details from code.

If the user refuses to clarify, halt the workflow and explain that task creation cannot proceed without a clear understanding.

---

## Phase 2 — Task ID Derivation

Evaluate these sources in order, stopping at the first valid one:

1. **Explicit ID in the prompt** — Use exactly as given
2. **Parent project + sibling pattern** — Match the naming pattern of existing subtasks (e.g. siblings are `phase-1`, `phase-2` → use `phase-3`)
3. **GitHub issue in conversation** — If a `#123` was mentioned earlier → `issue-123`
4. **Current branch name** — Run `git rev-parse --abbrev-ref HEAD`, parse for a task-like ID. Skip if it fails.
5. **Agent-generated** — Propose an ID from the description. No approval needed.

**Format rules**: lowercase, numbers, hyphens only. No numeric-only IDs. Max 20 characters. Uniqueness is enforced by the creation tool.

---

## Phase 3 — Task Creation

Call the **create_task** tool. The task is created with status `open`. Do not activate it — activation is governed separately by the active task guidelines.

---

## Phase 4 — Artifact Creation

1. Call **list_artifacts** for the newly created task
   - If this fails or doesn't return the task-details type, abort and notify the user
2. Update the **task-details** artifact — this is mandatory for every new task
3. Optionally update additional artifacts only if you already have concrete, relevant context for them. Do not fabricate content.

---

## Phase 5 — Report

Output a concise completion report:

```
Task created: {task_id}
Updated artifacts:
- {artifact_name}
```

List only artifacts that were actually populated. Keep it short and factual.
