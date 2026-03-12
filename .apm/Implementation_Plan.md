# Tasklist Tool – Hierarchical Task Management - APM Implementation Plan
**Memory Strategy:** Dynamic-MD
**Last Modification:** Completed Task 5.1 (Update Extension Tree Provider). Proceeding to Task 5.2 (Implement "Promote to Project" Command).
**Project Overview:** This project introduces a two-level hierarchy (Projects and Subtasks) to the Tasklist Tool. It involves updating the core models, enhancing the TaskManager with promotion logic and nested index management, updating path resolution in ArtifactService, and exposing these features via MCP tools and the VS Code Extension.

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

### Task 5.2 – Implement "Promote to Project" Command - Agent_Extension
- **Objective:** Add the UI command to the VS Code context menu.
- **Output:** New command registration in `packages/extension/src/commands.ts` and `package.json`.
- **Guidance:** Trigger the `TaskManager.promoteTaskToProject` method from the core.
- **Depends on:** Task 5.1 Output

### Task 5.3 – Extension Portfolio Update - Agent_Extension
- **Objective:** Update user-facing documentation for the extension.
- **Output:** Updated `packages/extension/README.md` and walkthroughs.
- **Guidance:** Illustrate the new workflow with a "Project/Subtask" example.
- **Depends on:** Task 5.2 Output
