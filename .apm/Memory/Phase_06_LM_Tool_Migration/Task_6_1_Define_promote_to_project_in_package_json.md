---
agent: Agent_Extension
task_ref: "Task 6.1"
status: Completed
ad_hoc_delegation: false
compatibility_issues: false
important_findings: false
---

# Task Log: Task 6.1 - Define promote_to_project in package.json

## Summary
Updated the extension manifest to replace the legacy VS Code command `tasklist.promoteToProject` with the new Language Model (LM) Tool `promote_to_project`.

## Details
- Added `promote_to_project` to `contributes.languageModelTools` in `packages/extension/package.json`.
- Mirrored the metadata (display name, descriptions, and input schema) from the existing MCP tool definition in `packages/mcp/src/tools/tasks.ts`.
- Removed the `tasklist.promoteToProject` command definition from the `commands` array.
- Removed all context menu registrations (both `inline` and `1_modification` groups) for the `tasklist.promoteToProject` command from `menus -> view/item/context`.
- Validated the updated `package.json` for JSON syntax correctness using `jq`.

## Output
- Modified file: `packages/extension/package.json`
- Added LM Tool: `promote_to_project`
- Removed command: `tasklist.promoteToProject`

## Issues
None

## Next Steps
- Implement the functional logic for the tool in `packages/extension/src/tools/promoteToProjectTool.ts` (Task 6.2).
