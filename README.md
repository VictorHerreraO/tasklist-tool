# Tasklist Tool

A suite of tools designed for structured task and artifact management, perfectly optimized for use by AI agents. This repository contains both a **VS Code extension** and a **Model Context Protocol (MCP) Server**, sharing the same underlying robust logic.

## Overview

The Tasklist Tool provides a framework for tracking development progress and maintaining structured documentation (artifacts) alongside code. By exposing Language Model Tools, AI agents can interactively manage tasks, state, and generate documentation using standard templates without requiring manual developer involvement.

### Repository Structure
This project is structured as a **monorepo** consisting of three npm packages:

- `@tasklist/core` (`packages/core/`): Shared business logic, task models, and Markdown template engine.
- `tasklist-tool` (`packages/extension/`): The VS Code extension wrapper.
- `@tasklist/mcp` (`packages/mcp/`): The standalone Model Context Protocol server.

## Key Features

- **Structured Task Management**: Create, start, and close tasks with unique tracking identifiers.
- **Active Task Context**: Set an "active" task to simplify subsequent operations and focus an agent's workflow.
- **Artifact Management**: Generate and update documentation artifacts (e.g., implementation plans, research notes, walkthroughs).
- **Template System**: Use YAML-based templates to ensure consistently structured documentation generation.
- **Custom Artifact Types**: Register new artifact types at the workspace level for unique domains.

## Available Agent Tools

Both the VS Code Extension and the MCP Server expose the exact same **11 core tools**:

### Task Lifecycle Tools
- `list_tasks`: Retrieve tasks from the workspace.
- `create_task`: Initialize a new task entry.
- `activate_task`: Set the current focus task.
- `deactivate_task`: Clear the active focus task.
- `start_task`: Transition a task to in-progress.
- `close_task`: Transition an in-progress task to closed.

### Artifact Management Tools
- `list_artifact_types`: Discover available documentation structures.
- `register_artifact_type`: Create custom documentation templates.
- `list_artifacts`: Show populated and available artifacts per task.
- `get_artifact`: Retrieve documentation structure or content.
- `update_artifact`: Write finished documentation for a task.

## Getting Started

### Installation
1. Clone the repository and open it in your terminal.
2. Run `npm install` at the root folder to pull dependencies and link the workspaces.
3. Run `npm run compile` to build the entire monorepo (`core`, `extension`, and `mcp`).

### Using the MCP Server

The standalone Model Context Protocol server operates over `stdio` and allows any MCP-compatible agent Client to manage your tasklist.

To boot the server on a project, set the `TASKLIST_WORKSPACE` environment variable to point to the repository the agent should manage, and run the binary:

```bash
export TASKLIST_WORKSPACE=/path/to/your/project
npx tasklist-mcp
```
*(Alternatively, execute `node packages/mcp/bin/tasklist-mcp` directly).*

### Running the VS Code Extension

1. After `npm install` and `npm run compile`, open the repository in VS Code.
2. Press `F5` to open a new VS Code development window with the extension loaded.

## Development Workflows

| Action                        | Command (from root) |
| ----------------------------- | ------------------- |
| **Compile All**               | `npm run compile`   |
| **Watch (Continuous Build)**  | `npm run watch`     |
| **Lint**                      | `npm run lint`      |
| **Run All Tests**             | `npm run test`      |
| **Package VS Code Extension** | `npm run package`   |

> **Note:** The `npm run package` command compiles the extension via `vsce` internally, and the built `.vsix` wrapper will be produced inside `packages/extension/`.

### GitHub Actions (CI/CD)
The project includes automated pipelines configured in `.github/workflows/`.
Pushes matched to `v*` tags will automatically run `npm run package` on the workspace and publish a GitHub Release with the bundled `.vsix` file attached.

## License

Refer to the project's license file for details.
