# Task Update Workflow

**Version:** 0.2.0

---

## Overview

This workflow defines how to update the persistent artifacts associated with a task, subtask, or project. Artifacts serve as a **level-2 context window** — external memory that survives beyond any single agent session, readable by both humans and future agents.

---

## Trigger Conditions

Update artifacts when:
- The **user explicitly requests** an update
- You've reached a **major decision** that affects task direction or scope
- You've uncovered a **major discovery** that changes understanding of the task
- A **session handoff** is happening (crash, timeout, or planned transfer)

Routine incremental progress does not trigger this workflow. Use judgment: if the information would meaningfully change what a future reader understands, update.

---

## Steps

### 1. Identify the target entity
Determine which task, subtask, or project needs updating.

### 2. Discover available artifact types
Call **list_artifact_types** to get the current set. Artifact types are dynamic — never assume a fixed list.

### 3. List artifacts for the target
Call **list_artifacts** with the entity ID. This returns all associated artifacts and whether each is an existing instance or a template.

### 4. Classify each artifact
- **Instance** (existing content) → Read current content, then patch or rewrite
- **Template** (no instance yet) → Use the template structure to create a new instance
- **Neither** → Skip silently

When creating from a template, preserve its structure for all future updates.

### 5. Scope to relevant artifacts
Update only artifacts affected by the current session's work. Leave unrelated artifacts untouched.

### 6. Retrieve and compare
For existing instances, retrieve full content and compare against current session knowledge.

### 7. Flag contradictions
If current findings contradict existing content, insert a flag before updating:

```
> ⚠️ CONTRADICTION: [Previous content stated X. Current session determined Y.]
```

Never silently overwrite contradicted content — the flag ensures traceability.

### 8. Write updates
- **Targeted changes** → Patch affected sections only
- **Major changes** → Rewrite in full, preserving template structure

All updates must be comprehensive, accurate, and structured.

When the user explicitly requests an update, treat it as a full knowledge dump — record everything known from the session, not just deltas.

### 9. Verify consistency
After updating, check that:
- Each artifact is internally consistent
- Parent–child relationships (e.g. project and subtask artifacts) don't contradict each other

---

## Purpose of Artifacts

Artifacts serve two audiences:
- **Human reviewers** — Inspect status, progress, and decisions without reading conversation history
- **Future agents** — Reconstruct sufficient context to continue work after a crash, timeout, or handoff

Write with the assumption that the next reader has **zero context** from the current session. Nothing material should exist only in conversation history.
