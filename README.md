# Tasklist Tool

A VS Code extension designed for structured task and artifact management, primarily optimized for use by AI agents within the VS Code environment.

## Overview

The Tasklist Tool provides a robust framework for tracking development progress and maintaining structured documentation (artifacts). By using Language Model Tools, AI agents can interactively manage tasks and generate documentation based on predefined templates.

## Key Features

- **Structured Task Management**: Create, start, and close tasks with unique identifiers.
- **Active Task Context**: Set an "active" task to simplify subsequent operations.
- **Artifact Management**: Generate and update documentation artifacts (e.g., implementation plans, research notes, walkthroughs).
- **Template System**: Use YAML-based templates to ensure consistent documentation structure.
- **Custom Artifact Types**: Register new artifact types and templates at the workspace level.

## Tech Stack

- **TypeScript**: Core language for development.
- **VS Code Extension API**: Integration with the VS Code ecosystem.
- **Mocha & VS Code Test API**: Comprehensive suite for unit, service, and integration testing.
- **js-yaml**: Parsing and handling structured template data.

## Getting Started

### Installation

1. Open the project in VS Code.
2. Run `npm install` to install dependencies.
3. Run `npm run compile` to build the extension.
4. Press `F5` to open a new VS Code window with the extension loaded.

### Available Tools (for AI Agents)

The extension contributes several Language Model Tools:

- `list_tasks`: Retrieve tasks from the workspace.
- `create_task`: Initialize a new task entry.
- `activate_task`: Set the current focus task.
- `start_task` / `close_task`: Manage task lifecycle transitions.
- `list_artifact_types`: Discover available documentation structures.
- `get_artifact` / `update_artifact`: Read or write documentation for a task.
- `register_artifact_type`: Create custom documentation templates.

## Project Structure

- `src/extension.ts`: Main entry point and tool registration.
- `src/tools/`: Implementation of individual Language Model Tools.
- `src/services/`: Core business logic (`TaskManager`, `ArtifactService`, `ArtifactRegistry`).
- `src/models/`: TypeScript interfaces and data models.
- `src/templates/`: Default Markdown templates for various artifact types.
- `src/test/`: Integration and unit tests.

## Development Workflows

| Action                       | Command           |
| ---------------------------- | ----------------- |
| **Compile**                  | `npm run compile` |
| **Watch (Continuous Build)** | `npm run watch`   |
| **Lint**                     | `npm run lint`    |
| **Run Tests**                | `npm run test`    |
| **Package extension**        | `npm run package` |

## License

Refer to the project's license file for details.
