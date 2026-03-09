# Tasklist Tool – Project Restructuring & MCP Server - APM Implementation Plan
**Memory Strategy:** Dynamic-MD
**Last Modification:** Task 2.2 completed; all 11 MCP tool wrappers implemented (6 task + 5 artifact). Phase 2 Complete.
**Project Overview:** Restructure the existing VS Code extension (TypeScript) into a monorepo workspace to extract the core LM Tool logic into a shared package. Then, implement a new Node/TypeScript MCP Server providing 1-to-1 feature parity with the extension's task and artifact management capabilities. The plan concludes with testing the new server wrapper and validating the existing VS Code extension remains fully functional.

## Phase 1: Monorepo Restructuring & Core Extraction
### Task 1.1 – Setup Workspace and Base Packages - Agent_Core [COMPLETED]
- **Objective:** Convert the current repository into an npm workspace and create the foundational package structures.
- **Output:** `package.json` with `workspaces` array, new `packages/core`, `packages/extension`, and `packages/mcp` directories with their respective `package.json` and `tsconfig.json` files.
- **Guidance:** Ensure the root `package.json` correctly defines the workspaces. Move the VS Code engine constraints and extension dependencies into `packages/extension`.
- **Depends on:** Plan creation

### Task 1.2 – Extract Core Logic - Agent_Core [COMPLETED]
- **Objective:** Move `TaskManager`, `ArtifactRegistry`, `ArtifactService`, models, and templates into `packages/core`.
- **Output:** Core logic successfully executing within `packages/core/src`, fully decoupled from `vscode` module imports.
- **Guidance:** Re-write or abstract any direct `vscode` API dependencies in the core tools to allow them to be consumed by non-VS Code environments (like the MCP server).
- **Depends on:** Task 1.1 Output

### Task 1.3 – Migrate Extension and Validate - Agent_Extension [COMPLETED]
- **Objective:** Migrate the extension's entry point and VS Code-specific tool wrappers into `packages/extension`, updating imports to use `packages/core`.
- **Output:** The VS Code extension successfully building and all 251 existing tests passing.
- **Guidance:** Update all integration tests to run against the newly structured packages. **Crucial validation step:** The extension must function identically to before the restructure.
- **Depends on:** Task 1.2 Output by Agent_Core

## Phase 2: MCP Server Implementation
### Task 2.1 – MCP Server Scaffolding - Agent_MCP [COMPLETED]
- **Objective:** Initialize the MCP server structure within `packages/mcp` using `@modelcontextprotocol/sdk`.
- **Output:** Basic MCP server setup with STDIO transport, ready to register tools.
- **Guidance:** Follow the guidelines from the `mcp-builder` skill. Set up the `package.json` with a dedicated execution script (e.g., `bin/tasklist-mcp`).
- **Depends on:** Task 1.3 Output by Agent_Extension

### Task 2.2 – Implement MCP Tool Wrappers - Agent_MCP [COMPLETED]
- **Objective:** Map the 11 core LM Tools from `packages/core` to MCP tool registrations.
- **Output:** `packages/mcp/src/index.ts` (or similar) with all tools registered, complete with Input/Output schemas and full descriptions matching the feature parity of the VS Code extension.
- **Guidance:** Ensure tools resolve the workspace context correctly (executing in the current repository where the agent is running).
- **Depends on:** Task 2.1 Output

## Phase 3: Final Testing & Execution Scripting
### Task 3.1 – MCP Server Testing - Agent_MCP
- **Objective:** Implement a test suite specific to the MCP server wrapper layer.
- **Output:** Passing tests in `packages/mcp/test/` verifying the MCP tool handlers correctly parse inputs and delegate to the core services.
- **Guidance:** Assert that error messages from the core services are correctly formatted into actionable MCP tool error responses.
- **Depends on:** Task 2.2 Output

### Task 3.2 – Execution Script Finalization & Verification - Agent_Core
- **Objective:** Finalize the `npx` / execution script configuration and verify the server starts correctly over STDIO.
- **Output:** A working execution script and a final verification that the monorepo builds cleanly (extension + core + mcp).
- **Guidance:** Ensure the `packages/mcp/package.json` specifies the `bin` field correctly for `npx` execution.
- **Depends on:** Task 3.1 Output by Agent_MCP
