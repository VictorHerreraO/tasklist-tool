---
agent: Agent_Extension
task_ref: "Task 7.1"
status: Completed
ad_hoc_delegation: false
compatibility_issues: false
important_findings: false
---

# Task Log: Task 7.1 - Update create_task & list_tasks Schemas

## Summary
Updated the extension manifest to include hierarchical parameters (`type` and `parentTaskId`) in the `create_task` and `list_tasks` Language Model (LM) tool schemas, ensuring parity with the core/MCP hierarchical capabilities.

## Details
- Updated `list_tasks` in `packages/extension/package.json`:
    - Added `parentTaskId` property to the `inputSchema` to allow filtering by project.
    - Updated `modelDescription` to clarify default top-level visibility.
- Updated `create_task` in `packages/extension/package.json`:
    - Added `type` property (enum: `task`, `project`) to the `inputSchema`.
    - Added `parentTaskId` property to the `inputSchema` to allow creating subtasks.
    - Updated `modelDescription` to explain project-based organization.
- Validated `package.json` for JSON syntax correctness using `jq`.

## Output
- Modified file: `packages/extension/package.json`

## Issues
None

## Next Steps
- Update the implementation of `create_task` and `list_tasks` tools in the extension to handle these new parameters (Task 7.2).
