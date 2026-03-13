---
agent: Agent_Extension
task_ref: "Task 6.2"
status: Completed
ad_hoc_delegation: false
compatibility_issues: false
important_findings: false
---

# Task Log: Task 6.2 - Implement PromoteToProjectTool.ts

## Summary
Implemented the `PromoteToProjectTool` class in the extension to handle Language Model (LM) tool invocations for task promotion.

## Details
- Updated `packages/extension/src/tools/interfaces.ts` to include `promote_to_project` in the documentation for `ITaskIdParams`, which is reused for this tool.
- Created `packages/extension/src/tools/promoteToProjectTool.ts` following the established pattern for LM tools.
- Implemented `prepareInvocation` with a user confirmation message: "Are you sure you want to promote task 'ID' to a project?...".
- Implemented `invoke` which calls `taskManager.promoteTaskToProject(taskId)` and returns a detailed success message with guidance on creating subtasks.
- Added robust error handling with recovery-oriented messages for "task not found" (suggesting `list_tasks`) and "already a project" scenarios.

## Output
- Modified file: `packages/extension/src/tools/interfaces.ts`
- Created file: `packages/extension/src/tools/promoteToProjectTool.ts`

## Issues
None

## Next Steps
- Wire and register the tool in `packages/extension/src/extension.ts` (Task 6.3).
