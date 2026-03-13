---
agent: Agent_QA
task_ref: "Task 6.4"
status: Completed
ad_hoc_delegation: false
compatibility_issues: false
important_findings: true
---

# Task 6.4 - Update Hierarchical Verification Suite

## Summary
Integrated tests for the `PromoteToProjectTool` LM tool into the extension's test suite and verified hierarchical state transitions.

## Work Performed
1. **Tool Testing:**
   - Added a new test suite for `PromoteToProjectTool` in `packages/extension/src/test/tools/taskTools.test.ts`.
   - Verified `prepareInvocation` returns correct confirmation messages including the `taskId`.
   - Verified the happy path for `invoke`: task promotion, success message, and underlying `TaskManager` state update.
   - Implemented error handling tests for "task not found" and "already a project" scenarios, ensuring helpful recovery guidance is provided.
2. **State Verification:**
   - Confirmed that promoting a task through the tool correctly updates the task type to `'project'` in the persisted index.
   - Verified that these changes correctly affect the `TaskTreeProvider` logic (e.g., setting `collapsibleState` to `Collapsed` for projects), allowing the Tree View to refresh accurately.
3. **Hierarchy Consistency Check:**
   - Identified that `create_task` and `list_tasks` LM tools in the extension currently lack `parentTaskId` support in their schemas and implementations, unlike their MCP counterparts.

## Findings & Observations
- The `PromoteToProjectTool` correctly surfaces errors from the `TaskManager` with context-aware suggestions (e.g., using `list_tasks`).
- The transition from command-based promotion to LM tool-based promotion preserves the logical requirements for workspace hierarchy.
- **Action Item:** Future tasks should update `create_task` and `list_tasks` LM tools to support hierarchical parameters (`parentTaskId`) for full consistency with the core engine and MCP tools.

## Success Criteria Checklist
- [x] Implement Tool Tests for `PromoteToProjectTool`.
- [x] Verify `prepareInvocation` messages.
- [x] Verify `invoke` happy path.
- [x] Verify `invoke` error handling.
- [x] Validate state changes for Tree View refresh.
- [x] Note hierarchy support gaps in other tools.
