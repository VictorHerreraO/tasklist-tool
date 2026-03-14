# Tighten Subtask API - APM Implementation Plan
**Memory Strategy:** Dynamic-MD
**Last Modification:** Plan creation by the Setup Agent.
**Project Overview:** This project standardizes subtask access by requiring `parentTaskId` and implementing a cascading activation model across the Core, MCP, and VS Code extension layers. Includes improved error messaging for AI agents and Active Path highlighting in the UI.

## Phase 1: Core Logic Updates
### Task 1.1 – Core TaskManager Updates - Agent_Core
- **Objective:** Update `TaskManager` to enforce `parentTaskId` scoping and conditionally activate the parent project during subtask activation.
- **Output:** Updated `packages/core/src/services/taskManager.ts`.
- **Guidance:** 
- Modify `findEntryGlobally(id, parentTaskId)` to ONLY search the specified parent index if `parentTaskId` is provided, and ONLY the root index if it's not.
- Update `activateTask(id, parentTaskId, activateProject)` to update both the parent project's index and the root index (conditionally based on `activateProject` flag) when a subtask is activated.
- Update `getActiveTask()` to recursively resolve active IDs to find the most specific active task.

### Task 1.2 – Core Hierarchy Unit Tests - Agent_QA
- **Objective:** Ensure unit tests cover the new scoping rules and conditional project activation.
- **Output:** Passing tests in `packages/core/src/test/taskManager.test.ts`.
- **Guidance:** **Depends on: Task 1.1 Output**
- Add test scenarios verifying that subtasks cannot be accessed without their `parentTaskId`.
- Add test scenarios verifying the `activateProject` flag appropriately cascades activation up to the root project index.

## Phase 2: MCP Layer Updates
### Task 2.1 – Update MCP Tool Schemas - Agent_MCP
- **Objective:** Update Zod schemas to accept `parentTaskId` and `activateProject`.
- **Output:** Updated `packages/mcp/src/tools/tasks.ts`.
- **Guidance:** **Depends on: Task 1.1 Output by Agent_Core**
- Update schemas for `activate_task`, `start_task`, and `close_task` to accept an optional `parentTaskId` string.
- Update `activate_task` to accept an optional `activateProject` boolean.
- Explicitly update the descriptions of these tools to guide AI agents to provide the `parentTaskId` when interacting with subtasks.

### Task 2.2 – Implement Hierarchical MCP Handlers - Agent_MCP
- **Objective:** Connect the updated schemas to the core logic, including recovery-oriented error messaging.
- **Output:** Updated `packages/mcp/src/handlers/taskHandlers.ts`.
- **Guidance:** **Depends on: Task 2.1 Output**
- Update handlers to pass the new `parentTaskId` and `activateProject` parameters to the `TaskManager` methods.
- Implement explicit error handling/catch blocks for task lookups: if a task is not found, return string feedback instructing the agent: "Task not found. AI Agent might have forgot to provide a parent project id."

## Phase 3: VS Code Extension Updates
### Task 3.1 – Synchronize Extension LM Tools - Agent_Extension
- **Objective:** Align the extension's LM tool schemas and implementations with the new hierarchy requirements and improved error messaging.
- **Output:** Updated `package.json`, `interfaces.ts`, and tool implementations within `packages/extension/src/tools/`.
- **Guidance:** **Depends on: Task 1.1 Output by Agent_Core**
- Update `package.json` schemas for `parentTaskId` and `activateProject`. Update the corresponding TS interfaces in `interfaces.ts`.
- Implement parameter passing in tool execution logic (`createTaskTool`, `listTasksTool`, `activateTaskTool`, `startTaskTool`, `closeTaskTool`).
- Ensure the recovery-oriented error message ("Task not found. AI Agent might have forgot to provide a parent project id.") is returned fully to the LM if lookup fails.

### Task 3.2 – Update Extension Sidebar Commands & UI - Agent_Extension
- **Objective:** Update UI context commands to support subtasks and implement "Active Path" highlighting in the tree view.
- **Output:** Updated `packages/extension/src/extension.ts` and `packages/extension/src/views/TaskTreeProvider.ts`.
- **Guidance:** **Depends on: Task 1.1 Output by Agent_Core**
- Update context menu commands (Start, Close, Promote) in `extension.ts` to pass the selected item's hierarchical context.
- Modify `TaskTreeProvider.ts` to visually highlight both the parent project and the active subtask simultaneously (Active Path).
- Ensure the tree view refreshes properly on hierarchical state changes.

## Phase 4: Final Verification
### Task 4.1 – Final System Verification & UI Walkthrough - Agent_QA
- **Objective:** Verify end-to-end functionality of the hierarchical system across all layers and update tasklist documentation.
- **Output:** Updated tasklist documentation artifacts for `tighten-subtask-api` project and subtasks.
- **Guidance:** **Depends on: Task 3.2 Output by Agent_Extension**
1. Run automated integration tests (if any exist) for the VS Code extension to ensure recent changes haven't broken the test suite. Ensure changes to package/core work properly on MCP and Extension environments.
2. Ad-Hoc Delegation - Request manual User validation of Extension UI (Active Path).
3. Use the tasklist tools (e.g., `update_artifact`) to compile all test results and User feedback into the artifacts for the `tighten-subtask-api` project and `tsa-verification` subtask, ensuring all documentation lives in the official artifacts.
