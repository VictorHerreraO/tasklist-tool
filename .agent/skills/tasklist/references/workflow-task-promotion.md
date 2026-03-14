# Task Promotion Workflow

**Version:** 0.2.0

---

## Overview

Task Promotion converts a **Task** into a **Project**, enabling it to hold subtasks. This is irreversible — the task's type is updated in place, and all existing artifacts are preserved and updated to reflect the new project context.

---

## Triggers

| Trigger             | Description                              | Agent Action                                             |
| ------------------- | ---------------------------------------- | -------------------------------------------------------- |
| **Agent-initiated** | Task scope meets the promotion threshold | Present rationale and request explicit user confirmation |
| **User-initiated**  | User explicitly requests promotion       | Confirm intent and execute                               |

The agent must **never** promote without explicit user confirmation, regardless of trigger type.

### Promotion Threshold (Agent-Initiated)

Consider promoting when **both** conditions are true:
1. The task involves **4 or more distinct phases or steps**
2. Those steps are **independently executable** by separate agents

If only one condition is met, promotion is not warranted.

---

## Workflow

1. **Identify trigger** — Scope threshold or user request
2. **Assess scope** — Retrieve artifacts and review task details
3. **Request confirmation** — Present rationale and ask for explicit approval
4. **Wait** — Take no action until confirmed
5. **Execute** — Call the `promote_to_project` tool
   - On failure: notify the user immediately; do not proceed
6. **Update artifacts** — Update available artifacts to reflect project state:
   - **Task Details**: Type updated from `task` to `project`
   - **Implementation Plan**: Reframed as delegatable subtasks, not single-agent steps
   - **Analysis**: Carried forward unchanged
7. **Report** — Output confirmation:
   ```
   TASK PROMOTION CONFIRMED
   ─────────────────────────────────────────
   Task ID     : {task_id}
   New Type    : project
   Status      : {status}

   Artifacts Updated:
     - Task Details       : updated
     - Implementation Plan: updated
     - Analysis           : [updated | not available]
   ─────────────────────────────────────────
   ```
8. **Handle subtasks** — Determine subtask source in priority order:
   1. **Implementation Plan** — Derive subtasks from defined phases
   2. **User-provided items** — Use items the user named in the request
   3. **Agent analysis** — Analyze scope and propose suggestions

Subtask suggestions are proposals only. Do not create subtasks without user approval.
