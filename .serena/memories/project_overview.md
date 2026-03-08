# Project Purpose
The Tasklist Tool is a VS Code extension designed to provide structured task and artifact management, primarily for AI agents. It allows creating, starting, and closing tasks, and managing associated documentation (artifacts) using templates.

# Tech Stack
- **Language**: TypeScript
- **Framework**: VS Code Extension API
- **Dependencies**: `js-yaml` for configuration/templates
- **Tools**: `eslint` (linting), `mocha` & `vscode-test` (testing), `tsc` (compilation), `vsce` (packaging)

# Codebase Structure
- `src/extension.ts`: Main entry point
- `src/tools/`: Implementation of Language Model Tools (e.g., `list_tasks`, `create_task`, `update_artifact`)
- `src/services/`: Core logic and services:
    - `taskManager.ts`: Handles task lifecycle and persistence.
    - `artifactService.ts`: Manages artifact file I/O.
    - `artifactRegistry.ts`: Manages artifact types and templates.
- `src/models/`: Data models for Tasks and Artifacts.
- `src/templates/`: Default Markdown templates for artifacts (e.g., `implementation-plan.ai.md`).
- `src/test/`: Comprehensive test suite including unit, service, and integration tests.
