# Project Purpose
The Tasklist Tool provides structured task and artifact management for AI agents. It consists of a VS Code extension and a Model Context Protocol (MCP) Server, sharing robust core logic for creating, tracking, and closing tasks and artifacts.

# Tech Stack
- **Language**: TypeScript
- **Ecosystem**: Node.js, npm workspaces (monorepo)
- **Frameworks**: VS Code Extension API, MCP SDK
- **Dependencies**: `js-yaml`
- **Tools**: `eslint` (linting), `mocha` (testing), `tsc` (compilation), `vsce` (packaging)

# Codebase Structure (Monorepo)
The project is inside `packages/`:
- **`@tasklist/core` (`packages/core/`)**: Shared logic. Contains `src/models/`, `src/services/`, and `src/templates/` (Markdown templates used for artifacts).
- **`tasklist-tool` (`packages/extension/`)**: VS Code extension wrapper. Contains `src/extension.ts`, `src/tools/`, and VS Code API specific `src/test/`.
- **`@tasklist/mcp` (`packages/mcp/`)**: The MCP server. Contains `src/server.ts`, `src/workspaceRoot.ts`, `src/handlers/`, and `src/tools/`.