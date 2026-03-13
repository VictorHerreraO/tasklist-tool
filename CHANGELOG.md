# Changelog

All notable changes to this project will be documented in this file.

## [0.3.3] - 2026-03-13

### Fixed
- **MCP Module Reliability**: Resolved a template resolution regression where built-in templates were missing in certain environments.
- **MCP Versioning**: Synchronized the MCP server's internal versioning with the monorepo release schedule.

## [0.3.2] - 2026-03-13

### Added
- **Logging Infrastructure**: Introduced a dedicated "Tasklist Tool" VS Code Output Channel for system logs and error reporting.

### Fixed
- **Activation Crash**: Resolved a critical `import.meta.url` collision in `@tasklist/core` preventing extension activation in bundled CommonJS environments.
- **Error Visibility**: Wrapped the extension activation flow in error traps to ensure initialization failures are reported to the user.

## [0.3.1] - 2026-03-13

### Fixed
- **UI Command Consistency**: Registered the `tasklist.createTask` UI-facing command and updated the welcome view to use it, resolving the non-functional "[Create Task]" link.
- **Activation Sequence**: Refactored activation logic to register all core commands (including `tasklist.refresh`) before workspace guards, ensuring the UI is always operational.
- **Empty State Synchronization**: Fixed a race condition where the Tree View would show "No tasks found" on startup despite valid tasks being present in the persistent index.

## [0.3.0] - 2026-03-13

### Added
- **Sync-and-Reveal Logic**: Added support for proactive UI behavior where the Task Explorer automatically expands parent projects and reveals active tasks upon activation.
- **Enhanced Visual State**: Implemented premium iconography and high-fidelity tooltips with Markdown formatting for task items.
- **Active Task Highlighting**: Improved visual feedback for active tasks with dedicated "active" status indicators in labels and descriptions.
- **Event Lifecycle Testing**: Formalized testing for the core `TaskManager` event system, ensuring 100% coverage for task creation, status changes, and activation.
- **Provider Logic Coverage**: Added robust unit tests for `getParent` and `getItemForId` logic in `TaskTreeProvider`.

### Changed
- Refactored `TaskTreeProvider` to implement hierarchical navigation requirements for `treeView.reveal`.
- Updated `extension.ts` event loop to intelligently trigger view reveals with optimal timing.

## [0.2.2] - 2026-03-12

### Fixed
- **View Registration Robustness**: Refactored `activate()` to register the Tree Data Provider synchronously at the very start of activation. This prevents "no data provider" errors caused by early returns (e.g., no workspace) or delays in asynchronous service initialization.

## [0.2.1] - 2026-03-12

### Fixed
- **View Activation**: Added `onView:tasklist-tree` activation event to extension manifest.

## [0.2.0] - 2026-03-12

### Added
- **Hierarchical Task Management**: Support for organizing tasks into Projects and Subtasks.
- **Task Promotion**: Ability to promote a standard task to a Project container.
- **Nested Indexing**: Project-specific indices for subtasks to keep the root clean.
- **New MCP Tool**: `promote_to_project` tool for agents.
- **Updated MCP Tools**: `create_task` and `list_tasks` now support parent/child relationships.
- **VS Code Tree View Support**: Projects are now rendered as expandable folders with distinct status icons in the Tasklist Explorer.

### Changed
- Updated `@tasklist/core` models to include `type` field (`task` | `project`).
- Artifact resolution logic updated to support nested directory structures: `.tasks/[projectId]/[taskId]/`.
- `list_tasks` now defaults to showing top-level items only, with optional project filtering.

### Fixed
- Improved resilience of artifact migration during task promotion.

## [0.1.3] - 2026-03-09
- Baseline version with flat task management and core artifact templates.
