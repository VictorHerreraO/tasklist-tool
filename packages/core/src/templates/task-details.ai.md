---
id: task-details
displayName: Task Details
description: Structured overview of the task scope, goals, constraints, and acceptance criteria. Use this template when beginning a new complex objective to clarify and align on what exactly needs to be done and what is out of scope.
filename: task-details.ai.md
---

# Task Details

> [!NOTE]
> **Task Hierarchy**: The workspace supports a two-level hierarchy of **Projects** and **Subtasks**.
> - **Project**: A container (type: 'project') that groups related subtasks.
> - **Subtask**: A granular task belonging to a parent project.
> Agents can use `promote_to_project` to convert a task into a container, and `create_task` with `parentTaskId` to organize specific work items.

## Task Information
- **Type**: <!-- 'task' | 'project' -->
- **Parent ID**: <!-- parentTaskId (if subtask) -->

## Goal
<!-- Describe the primary objective of this task in 1-2 sentences. -->

## Scope
<!-- What is explicitly in scope for this task? -->

## Out of Scope
<!-- What is explicitly excluded from this task? -->

## Acceptance Criteria
<!-- List the measurable conditions that define "done". -->
- [ ]
- [ ]

## Constraints & Assumptions
<!-- Note any technical constraints, dependencies, or assumptions made. -->

## References
<!-- Links to related issues, PRs, specs, or prior art. -->
