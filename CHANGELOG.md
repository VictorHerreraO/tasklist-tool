# Changelog

All notable changes to this project will be documented in this file.

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
