# Project Management Workflow

**Version:** 0.2.0

---

## What Is a Project?

A project is a structured container for breaking down complex work into subtasks — analogous to an **epic** in agile. It serves two purposes:

1. **Work decomposition** — Making large tasks tractable by splitting them into self-contained subtasks
2. **Context offloading** — Externalizing state to artifacts so agents can context-switch without relying on memory

Think of a project as a folder: each folder contains items (subtasks) related to a specific initiative.

---

## Structure

A project shares its artifact structure with standard tasks and additionally contains subtasks. Key artifacts include:

- **Task Detail** — Full scope and objectives of the project
- **Analysis** — Research or assessments performed on the project
- **Implementation Plan** — High-level overview mapping subtasks to intended outcomes

A project also tracks an **active subtask**, representing the current phase of work.

---

## Subtasks

A subtask is the smallest atomic unit of work within a project. The framework supports **two levels only**: projects contain subtasks, and subtasks cannot be nested further.

### Creation

Subtasks can be created by the user or the agent. Agent-initiated creation happens when:
- The user asks to break down scope into subtasks
- The agent begins planning phase work and creates all foreseeable subtasks upfront
- The agent identifies a gap not covered by existing subtasks (must notify the user)

When creating subtasks during planning, create them all at once — not incrementally. Each must be fully self-contained with enough context for any agent to execute it independently.

### Requirements

Each subtask must include:
- Full context sufficient to work without prior conversation history
- A reference to the parent project for broader awareness
- Task details and an implementation plan scoped to that subtask

### Dependencies

Subtasks may depend on other subtasks. Don't start a dependent subtask until its blocker is complete. Once a blocker is done, all waiting subtasks become eligible for execution simultaneously — multiple agents may work on them in parallel.

---

## Activation Model

Projects use a two-level activation model:

| Level            | Scope                     | Active Entity                  |
| ---------------- | ------------------------- | ------------------------------ |
| Global task list | Across all projects/tasks | Active Task (may be a project) |
| Project level    | Within a specific project | Active Subtask                 |

Activating a subtask within a project does **not** automatically activate the parent project globally. These are independent state machines — manage both explicitly.

---

## Lifecycle

- **Creation** → Status: `open` (does not auto-activate)
- **In progress** → Set when work begins on the first subtask, or on explicit user instruction
- **Closed** → Only on explicit user instruction, even after all subtasks are complete

The user is the authority on when a project is truly done — testing, QA, or PR review may introduce additional subtasks after initial implementation.
