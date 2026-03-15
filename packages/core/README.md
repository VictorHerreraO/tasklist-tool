# @tasklist/core

The core logic engine for the **Tasklist Tool**. This package provides the domain models, service layers, and template engine shared by both the VS Code extension and the MCP server.

## Purpose

By isolating the business logic in `@tasklist/core`, we ensure that task management behavior (creation, state transitions, artifact generation) is consistent regardless of whether it's accessed via a GUI (VS Code) or a programmatic interface (MCP).

## Key Components

### Models
- **Task**: Represents a unit of work. Supports hierarchy (projects vs tasks) and status tracking (`open`, `in-progress`, `closed`).
- **Artifact**: Represents structured documentation associated with a task.

### Services
- **TaskManager**: Handles operations on the task index, including persistence and state transitions.
- **ArtifactRegistry**: Manages the available artifact types and their templates.
- **ArtifactService**: Coordinates the generation and updating of artifact files.

### Template Engine
The core includes a robust YAML-based template engine used to generate structured Markdown documents. This allows agents to produce highly consistent documentation like implementation plans and research notes.

## Development

### Building
```bash
npm run compile
```

### Testing
This package uses `mocha` and `chai` for unit testing.
```bash
npm run test
```
