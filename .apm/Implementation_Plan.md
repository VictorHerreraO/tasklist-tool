# Tasklist Tool – VS Code LM Extension - APM Implementation Plan
**Memory Strategy:** Dynamic-MD
**Last Modification:** Task 1.1 complete. Preparing Task 1.2.
**Project Overview:** Build a VS Code extension using the Language Model Tool API (TypeScript) that provides AI agents with structured task and artifact management. The extension exposes multiple LM tools enabling agents to create/manage tasks (with lifecycle states: open → in-progress → closed), track an active task, and create/read/update standardized artifacts (`.ai.md` files). The artifact registry uses a two-tier template system: built-in defaults bundled with the extension and custom workspace-level templates in `.tasks/templates/` that can be registered at runtime via an LM tool. Task state is persisted in a lightweight `.tasks/index.json` manifest at the workspace root, with artifacts stored in `.tasks/{task-id}/` directories.

## Phase 1: Project Scaffolding & Configuration

### Task 1.1 – Initialize Extension Project Structure - Agent_Extension
- **Objective:** Scaffold the VS Code TypeScript extension skeleton following the `vscode-lm-tool-builder` skill guide.
- **Output:** Complete project structure with `src/`, `out/`, `.vscode/`, `test/` directories, `tsconfig.json`, `package.json` (engine, main, scripts), ESLint config, test infrastructure (Mocha + `@vscode/test-cli` + `@vscode/test-electron`), and `.gitignore`.
- **Guidance:** Follow the skill guide at `.agents/skills/vscode-lm-tool-builder/SKILL.md` exactly. Omit publishing configurations. Set VS Code engine to `^1.100.0` minimum. Ensure scripts include compile, watch, lint, test, and prepublish.
- **Instructions:**
  - Create standard folder structure: `src/`, `out/`, `.vscode/`, `test/`.
  - Generate `tsconfig.json` targeting ES2020 with strict mode, output to `out/`.
  - Configure `.vscode/launch.json` for Extension Development Host debugging.
  - Set up ESLint with `@typescript-eslint` plugin and Mocha test infrastructure per skill guide.
  - Create a minimal `src/extension.ts` with empty `activate` and `deactivate` exports.

### Task 1.2 – Configure LM Tool Contribution Points in package.json - Agent_Extension
- **Objective:** Define all language model tool contribution points in `package.json` with complete schemas and descriptions.
- **Output:** `package.json` `contributes.languageModelTools` section with all 11 tool definitions.
- **Guidance:** Follow the `{verb}_{noun}` naming convention from the LM Tool API guide. Each tool must have: `name`, `displayName`, `modelDescription`, `userDescription`, `canBeReferencedInPrompt: true`, `icon`, `toolReferenceName`, and `inputSchema`. Write detailed `modelDescription` values so the LLM knows when to invoke each tool. **Depends on: Task 1.1 Output**
- **Instructions:**
  - Define task management tools: `list_tasks` (filter by status), `create_task` (task ID input), `activate_task`, `deactivate_task`, `start_task`, `close_task`.
  - Define artifact management tools: `list_artifact_types`, `list_artifacts` (task ID or active), `get_artifact` (type + task ID or active), `update_artifact` (type + content + task ID or active), `register_artifact_type` (id, displayName, description, template body).
  - For each tool, write an `inputSchema` describing all parameters with types, descriptions, and defaults.
  - Write `modelDescription` values that clearly explain when the tool should/shouldn't be used, what it returns, and its limitations.

## Phase 2: Data Layer & Core Services

### Task 2.1 – Implement Task Manager Service - Agent_Core
- **Objective:** Build the core task management service that handles `.tasks/index.json` CRUD operations and task state machine.
- **Output:** `src/services/taskManager.ts` with full task lifecycle management, plus `src/models/task.ts` with TypeScript interfaces.
- **Guidance:** Keep `index.json` lightweight — store only task ID, status, and timestamps per task. Persist `activeTaskId` at the index root level. All state transitions must be explicit (activate/deactivate/start/close) with descriptive error messages for invalid transitions. Ensure the `.tasks/` directory and `index.json` are created lazily on first use. **Depends on: Task 1.1 Output by Agent_Extension**
- **Steps:**
  1. Define TypeScript interfaces in `src/models/task.ts`: `TaskStatus` enum (`open`, `in-progress`, `closed`), `TaskEntry` interface (id, status, createdAt, updatedAt), `TaskIndex` interface (activeTaskId, tasks array).
  2. Implement `TaskManager` class in `src/services/taskManager.ts` with methods: `createTask(id)`, `listTasks(statusFilter?)`, `getActiveTask()`, `activateTask(id)`, `deactivateTask()`, `startTask(id)`, `closeTask(id)`.
  3. Implement state machine validation: `start` only from `open`, `close` only from `in-progress`. Return descriptive error messages for invalid transitions (e.g., "Cannot close task 'X': current status is 'open', expected 'in-progress'. Use 'start_task' first.").
  4. Write unit tests in `test/services/taskManager.test.ts` covering: create, list with filters, activate/deactivate, valid transitions, invalid transition errors, lazy directory creation.

### Task 2.2 – Implement Artifact Registry & Template System - Agent_Core
- **Objective:** Build a flexible, extensible artifact type registry with two-tier template loading: built-in defaults bundled with the extension and custom workspace-level templates registered at runtime.
- **Output:** `src/services/artifactRegistry.ts` with registry logic, `src/models/artifact.ts` with interfaces, and `src/templates/` directory with default template definition files.
- **Guidance:** Template definition files (e.g., `src/templates/research.ai.md`) use YAML frontmatter as metadata (`id`, `displayName`, `description`, `filename`) and Markdown body as the content skeleton. The registry uses **two-tier loading**: (1) built-in defaults parsed from bundled `src/templates/` at activation, (2) custom workspace templates loaded from `.tasks/templates/` at activation and registerable at runtime. Generated artifact files written to `.tasks/{task-id}/` are **plain Markdown with no frontmatter** — only the body portion of the template is used.
- **Steps:**
  1. Define interfaces in `src/models/artifact.ts`: `ArtifactType` (id, displayName, description, filename, templateBody), `ArtifactInfo` (type, path, exists flag).
  2. Create 5 default template definition files in `src/templates/`: `task-details.ai.md`, `research.ai.md`, `implementation-plan.ai.md`, `walkthrough.ai.md`, `review.ai.md`. Each file has YAML frontmatter (id, displayName, description, filename) and a Markdown body with appropriate section headings for its purpose.
  3. Implement `ArtifactRegistry` class in `src/services/artifactRegistry.ts` with methods: `getTypes()`, `getType(id)`, `registerType(type)`, `getFilename(typeId)`, `getTemplate(typeId)`. On initialization, parse template definition files from both bundled `src/templates/` and workspace `.tasks/templates/` (if exists), extracting frontmatter as metadata and body as the template content.
  4. Add `registerAndPersistType(workspacePath, type)` method: writes a new template definition file to `.tasks/templates/{id}.ai.md` with proper frontmatter and body, then registers it in the in-memory registry immediately (available in the current session without restart).
  5. Write unit tests in `test/services/artifactRegistry.test.ts` covering: list default types, get by ID, register custom type (in-memory), register and persist type (writes to disk + in-memory), two-tier loading (bundled + workspace), get filename, get template body (no frontmatter), error on unknown type.

### Task 2.3 – Implement Artifact File I/O Service - Agent_Core
- **Objective:** Build the file I/O service for reading/writing `.ai.md` artifact files within task directories.
- **Output:** `src/services/artifactService.ts` with complete artifact file operations.
- **Guidance:** On `get_artifact`, if the file doesn't exist, return the plain Markdown template body from the registry so the agent can fill it in. On `update_artifact`, overwrite the entire file with the provided content. Generated artifact files are plain Markdown (no frontmatter). Listing artifacts should check which registered artifact files actually exist in the task directory. **Depends on: Task 2.2 Output**
- **Steps:**
  1. Implement `ArtifactService` class in `src/services/artifactService.ts` with methods: `listArtifacts(taskId)`, `getArtifact(taskId, typeId)`, `updateArtifact(taskId, typeId, content)`.
  2. For `getArtifact`: check if `.tasks/{taskId}/{filename}` exists. If yes, read and return content. If no, return the plain Markdown template body from the registry (no frontmatter — just the section headings and structure).
  3. For `updateArtifact`: validate task exists via TaskManager, resolve filename from registry, write full content to `.tasks/{taskId}/{filename}`, creating the directory if needed.
  4. Write unit tests in `test/services/artifactService.test.ts` covering: list artifacts (some exist, none exist), get existing artifact, get non-existing (returns template body without frontmatter), update artifact (create new, overwrite existing), error on unknown artifact type.

## Phase 3: LM Tool Implementations

### Task 3.1 – Implement Task Management Tools - Agent_Core
- **Objective:** Implement the 6 task management LM tool classes that wire to the TaskManager service.
- **Output:** Tool classes in `src/tools/` directory: `listTasksTool.ts`, `createTaskTool.ts`, `activateTaskTool.ts`, `deactivateTaskTool.ts`, `startTaskTool.ts`, `closeTaskTool.ts`.
- **Guidance:** Each tool class implements `vscode.LanguageModelTool<T>` with `prepareInvocation` (confirmation message) and `invoke` (calls TaskManager, returns `LanguageModelToolResult` with descriptive text). All errors must throw with LLM-friendly messages explaining what went wrong and suggesting corrective actions. **Depends on: Task 2.1 Output**
- **Steps:**
  1. Define input parameter interfaces for each tool in `src/tools/interfaces.ts` (e.g., `ICreateTaskParams { taskId: string }`, `IListTasksParams { status?: string }`, `ITaskIdParams { taskId: string }`).
  2. Implement all 6 tool classes following the LM Tool API pattern: constructor, `prepareInvocation` with contextual confirmation messages, `invoke` with TaskManager calls and formatted `LanguageModelToolResult` responses.
  3. Write unit tests in `test/tools/taskTools.test.ts` covering: each tool's invoke with valid inputs, error handling for invalid inputs, confirmation message content.

### Task 3.2 – Implement Artifact Management Tools - Agent_Core
- **Objective:** Implement the 5 artifact management LM tool classes that wire to ArtifactRegistry and ArtifactService.
- **Output:** Tool classes in `src/tools/` directory: `listArtifactTypesTool.ts`, `listArtifactsTool.ts`, `getArtifactTool.ts`, `updateArtifactTool.ts`, `registerArtifactTypeTool.ts`.
- **Guidance:** Tools that accept a `taskId` parameter should default to the active task (from TaskManager) when `taskId` is not provided. The `get_artifact` tool returns current content or template on first access. The `update_artifact` tool accepts full content replacement. The `register_artifact_type` tool persists a new custom type to `.tasks/templates/` and registers it in-memory immediately (no restart needed). **Depends on: Task 2.2 Output, Task 2.3 Output, Task 2.1 Output**
- **Steps:**
  1. Define input parameter interfaces in `src/tools/interfaces.ts` (append to existing): `IListArtifactsParams { taskId?: string }`, `IGetArtifactParams { artifactType: string, taskId?: string }`, `IUpdateArtifactParams { artifactType: string, content: string, taskId?: string }`, `IRegisterArtifactTypeParams { id: string, displayName: string, description: string, templateBody?: string }`.
  2. Implement all 5 tool classes: `list_artifact_types` (no input, returns registry), `list_artifacts` (resolves taskId or active, returns artifact list with existence status), `get_artifact` (returns content or template), `update_artifact` (writes content, returns confirmation), `register_artifact_type` (calls `registerAndPersistType`, returns confirmation with new type details).
  3. Write unit tests in `test/tools/artifactTools.test.ts` covering: each tool's invoke, active task fallback, template generation on first get, update with content, register new type (persisted and immediately available), error handling.

## Phase 4: Integration & Final Assembly

### Task 4.1 – Extension Entry Point & Tool Registration - Agent_Core
- **Objective:** Wire all 11 LM tools in the extension's `activate` function and ensure proper lifecycle management.
- **Output:** Updated `src/extension.ts` with complete tool registration.
- **Guidance:** Use `vscode.lm.registerTool` for each tool. Add all registrations to `context.subscriptions` for proper disposal. Initialize services (TaskManager, ArtifactRegistry, ArtifactService) once — ArtifactRegistry must load both bundled and workspace templates during initialization. Inject services into tool constructors. **Depends on: Task 3.1 Output, Task 3.2 Output**
- **Instructions:**
  - Instantiate `TaskManager`, `ArtifactRegistry` (with two-tier template loading), and `ArtifactService` in the `activate` function.
  - Register all 11 tools with `vscode.lm.registerTool`, passing service instances to each tool constructor.
  - Push all registrations into `context.subscriptions` for cleanup on deactivation.

### Task 4.2 – Integration Testing & Error Scenarios - Agent_Core
- **Objective:** Write integration tests validating complete task and artifact lifecycles, error scenarios, and edge cases.
- **Output:** Integration test files in `test/integration/` directory.
- **Guidance:** Test the full flow: create task → activate → start → create artifacts → read artifacts → update artifacts → close task. Also test all error paths. **Depends on: Task 4.1 Output**
- **Steps:**
  1. Write task lifecycle integration tests: create → list (filter) → activate → start → close → deactivate, verifying `index.json` state at each step.
  2. Write artifact lifecycle integration tests: get artifact (template returned) → update artifact → get artifact (content returned) → list artifacts (shows existence).
  3. Write error scenario tests: invalid state transitions, missing tasks, unknown artifact types, deactivate when no active task, operations on closed tasks.
  4. Compile the full project (`npm run compile`) and run all tests (`npm test`) to validate everything passes.
