# Tasklist Tool – Hierarchical Task Management - APM Implementation Plan
**Memory Strategy:** Dynamic-MD
**Last Modification:** Task 6.1 completed; LM Tool definition added to extension manifest.
**Project Overview:** This project introduces a two-level hierarchy (Projects and Subtasks) to the Tasklist Tool. Following the initial implementation, the "Promote to Project" functionality is being migrated from a standard VS Code command to a Language Model (LM) Tool for improved agentic integration and consistency.

## Phase 1: Test Infrastructure & Baseline
### Task 1.1 – Core Test Environment Setup - Agent_QA
- **Objective:** Configure a dedicated test runner and compilation config for `packages/core` to enable localized testing.
- **Output:** Updated `packages/core/package.json` with test dependencies and scripts, `.mocharc.json`, and `tsconfig.json` for independent compilation.
- **Guidance:** Use Mocha and Chai, matching the patterns in the extension package but tailored for core. Ensure the tsconfig enables independent package compilation.
- **Depends on:** Plan creation

### Task 1.2 – Relocate TaskManager Tests - Agent_Core
- **Objective:** Move existing TaskManager tests to the core package.
- **Output:** `packages/core/src/test/taskManager.test.ts` with updated local imports.
- **Guidance:** Ensure all imports point to local source files instead of the `@tasklist/core` package.
- **Depends on:** Task 1.1 Output by Agent_QA

### Task 1.3 – Relocate ArtifactService Tests - Agent_Core
- **Objective:** Move existing ArtifactService tests to the core package.
- **Output:** `packages/core/src/test/artifactService.test.ts` with updated local imports.
- **Guidance:** Similar to Task 1.2, ensure import paths are correctly refactored.
- **Depends on:** Task 1.1 Output by Agent_QA

## Phase 2: Foundation (Models & Manager)
### Task 2.1 – Update Task Models - Agent_Core
- **Objective:** Introduce the `type` field and `parentTaskId` to the core task interfaces.
- **Output:** Updated `packages/core/src/models/task.ts` with `type: 'task' | 'project'` and optional `parentTaskId: string`.
- **Guidance:** Ensure the `TaskEntry` interface is updated to support both fields.
- **Depends on:** Task 1.2 Output

### Task 2.2 – TaskManager Core Update - Agent_Core
- **Objective:** Update basic TaskManager operations to satisfy the new model requirements.
- **Output:** Updated `TaskManager.ts` with `createTask` supporting the `type` field and `listTasks` filtering for top-level items by default.
- **Guidance:** `listTasks` should only return items without a `parentTaskId` unless a specific filter is applied.
- **Depends on:** Task 2.1 Output

## Phase 3: Logic (Promotion & Nested Resolution)
### Task 3.1 – Implement Task Promotion Logic - Agent_Core
- **Objective:** Implement the mechanism to transition a task into a project.
- **Output:** `promoteTaskToProject(taskId: string)` method in `TaskManager` that updates the index and creates a nested `index.json`.
- **Guidance:** Change the task type to 'project' and immediately create a folder `.tasks/${taskId}/` containing an empty `TaskIndex`.
- **Depends on:** Task 2.2 Output

### Task 3.2 – Nested Index Management - Agent_Core
- **Objective:** Enable creation and listing of subtasks within projects with strict index synchronization.
- **Output:** Updated `createTask` and `listTasks` in `TaskManager` to handle nested directory structures and maintain parent/child index consistency.
- **Guidance:** Subtasks must be created in `.tasks/${parentTaskId}/index.json`. Ensure that any changes to a project's subtasks are reflected in the parent-level index if necessary (or properly filtered).
- **Depends on:** Task 3.1 Output

### Task 3.3 – Artifact Path Resolution Update - Agent_Core
- **Objective:** Adapt path resolution to support the nested filesystem structure.
- **Output:** Updated `ArtifactService` that correctly resolves paths for subtask artifacts (e.g., `.tasks/${projectId}/${taskId}/artifact.md`).
- **Guidance:** The `projectId` must be passed explicitly to artifact operations as per discovery findings. Update constructor or initialization if needed to handle base project paths.
- **Depends on:** Task 3.2 Output

## Phase 4: Integration (MCP Tools & Testing)
### Task 4.1 – MCP Tool Definition Update - Agent_MCP (Completed)
- **Objective:** Expose the new hierarchy features to AI agents via the MCP server.
- **Output:** Updated tool schemas in `packages/mcp/src/tools/tasks.ts` for `create_task`, `list_tasks`, and a new `promote_to_project` tool.
- **Guidance:** Update `create_task` schema to include `parentTaskId?: string` and `type?: 'task' | 'project'`. Update descriptions to clearly explain the Project/Task two-level hierarchy.
- **Depends on:** Task 3.3 Output by Agent_Core

### Task 4.2 – Hierarchical Verification Suite - Agent_QA (Completed)
- **Objective:** Implement comprehensive tests for the new hierarchical features.
- **Output:** `packages/core/src/test/hierarchy.test.ts` with passing tests for promotion and subtask management.
- **Guidance:** Follow existing test patterns for directory mocking and index validation. Include recursive cleanup tests.
- **Depends on:** Task 4.1 Output by Agent_MCP

### Task 4.3 – Documentation Update - Agent_MCP (Completed)
- **Objective:** Update system templates to reflect the new hierarchy.
- **Output:** Updated `packages/core/src/templates/task-details.ai.md` mentioning the project type.
- **Guidance:** Ensure agents are aware they can now organize work into projects.
- **Depends on:** Task 4.1 Output

## Phase 5: VS Code Extension Integration
### Task 5.1 – Update Extension Tree Provider - Agent_Extension (Completed)
- **Objective:** Update the VS Code Tree View to render hierarchical tasks.
- **Output:** Modified `packages/extension/src/views/TaskTreeProvider.ts` supporting nested `TreeItem` children.
- **Guidance:** Ensure projects are expandable and subtasks are rendered correctly nested.
- **Depends on:** Task 3.3 Output

### Task 5.2 – Implement "Promote to Project" Command - Agent_Extension (Completed)
- **Objective:** Add the UI command to the VS Code context menu.
- **Output:** New command registration in `packages/extension/src/extension.ts` and `package.json`.
- **Guidance:** Trigger the `TaskManager.promoteTaskToProject` method from the core.
- **Depends on:** Task 5.1 Output

### Task 5.3 – Extension Portfolio Update - Agent_Extension (Completed)
- **Objective:** Update user-facing documentation for the extension.
- **Output:** Updated `packages/extension/README.md` and any relevant walkthrough/documentation files.
- **Guidance:** Illustrate the new workflow with a "Project/Subtask" example.
- **Depends on:** Task 5.2 Output

## Phase 6: Language Model Tool Migration
### Task 6.1 – Define promote_to_project in package.json - Agent_Extension (Completed)
- **Objective:** Update the extension manifest to swap the UI command for an LLM-accessible tool.
- **Output:** Updated `packages/extension/package.json`.
- **Guidance:** 1:1 mapping with MCP tool metadata.
- Remove `tasklist.promoteToProject` from `commands` and `view/item/context` menu.
- Add `promote_to_project` to `languageModelTools` mirroring MCP tool's descriptions.
- Define `inputSchema` with a required `taskId` parameter.

### Task 6.2 – Implement PromoteToProjectTool.ts - Agent_Extension
- **Objective:** Implement the functional logic of the LM tool as a dedicated class.
- **Output:** `packages/extension/src/tools/promoteToProjectTool.ts`.
- **Guidance:** Follow existing tool patterns. **Depends on: Task 6.1 Output**
1. Create file following existing patterns in `tools/`.
2. Define interface `IPromoteToProjectParameters`.
3. Implement `prepareInvocation` with confirmation: "Promote task 'ID' to a project?".
4. Implement `invoke` calling `taskManager.promoteTaskToProject`.
5. Return recovery-oriented error messages on failure (e.g., "Check taskId via list_tasks").

### Task 6.3 – Wiring and Cleanup in extension.ts - Agent_Extension
- **Objective:** Integrate the tool and remove the old command-based logic.
- **Output:** Updated `packages/extension/src/extension.ts`.
- **Guidance:** **Depends on: Task 6.2 Output**
- Import and register `PromoteToProjectTool` with `vscode.lm.registerTool`.
- Remove `vscode.commands.registerCommand` for `tasklist.promoteToProject`.
- Cleanup unused imports like `TaskTreeItem`.

### Task 6.4 – Update Hierarchical Verification Suite - Agent_QA
- **Objective:** Ensure the system functions correctly through the new interaction model.
- **Output:** Passing integration tests.
- **Guidance:** **Depends on: Task 6.3 Output**
1. Identify and refactor tests in `packages/extension/src/test/integration/` involving promotion.
2. Update tests to verify promotion via LM Tool invocation or Core state.
3. Validate complete hierarchical workflow ensures Tree View refresh logic still holds.
