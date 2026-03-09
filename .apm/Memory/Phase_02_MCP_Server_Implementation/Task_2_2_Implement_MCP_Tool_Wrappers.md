---
agent: Agent_MCP
task_ref: Task 2.2 - Implement MCP Tool Wrappers
status: Completed
ad_hoc_delegation: false
compatibility_issues: false
important_findings: true
---

# Task Log: Task 2.2 - Implement MCP Tool Wrappers

## Summary
Implemented all 11 MCP tool wrappers in `packages/mcp/src/`, including a full structural refactor of the package. All tools compile cleanly and the server starts successfully. Feature parity with the extension's LM tools is maintained.

## Details

### Step 1 – Structural refactor
Split the monolithic `src/index.ts` (from Task 2.1) into three responsibilities:
- **`src/server.ts`**: creates and exports the singleton `McpServer` instance
- **`src/tools/tasks.ts`** and **`src/tools/artifacts.ts`**: register tools as side effects by importing `server` from `./server.js` and calling `server.tool()`
- **`src/index.ts`** (updated): imports tool modules as side effects, then connects transport and calls `main()`

### Step 2 – Workspace resolution (`src/workspaceRoot.ts`)
Created module that:
- Resolves `workspaceRoot` from `TASKLIST_WORKSPACE` env var or `process.cwd()`
- Instantiates `TaskManager`, `ArtifactRegistry`, and `ArtifactService` as singletons
- Calls `artifactRegistry.initialize()` synchronously at module load time

**Important finding**: `ArtifactRegistry.initialize()` uses `__dirname` inside the CJS-compiled core module to locate built-in templates — **not** the `extensionRoot` argument passed to the constructor. The constructor argument is stored but unused in `initialize()`. Thus in the MCP context, passing `workspaceRoot` for both arguments is safe. Workspace-level templates are still loaded correctly from `{workspaceRoot}/.tasks/templates/`.

### Step 3 – Tool registration

Reviewed all 12 extension source files (11 tool classes + interfaces) to match error messages, active-task fallback logic, and schema shapes exactly.

**Task tools (6) — `src/tools/tasks.ts`:**
| Tool              | Core method                            | Notes                                  |
| ----------------- | -------------------------------------- | -------------------------------------- |
| `list_tasks`      | `taskManager.listTasks(statusFilter?)` | Zod enum validates status              |
| `create_task`     | `taskManager.createTask(id)`           | Guards duplicate ID error              |
| `activate_task`   | `taskManager.activateTask(id)`         | Guards not-found error                 |
| `deactivate_task` | `taskManager.deactivateTask()`         | No-arg, idempotent                     |
| `start_task`      | `taskManager.start_task(id)`           | Guards not-found + wrong-status errors |
| `close_task`      | `taskManager.close_task(id)`           | Guards not-found + wrong-status errors |

**Artifact tools (5) — `src/tools/artifacts.ts`:**
| Tool                     | Core method                                               | Notes                                                 |
| ------------------------ | --------------------------------------------------------- | ----------------------------------------------------- |
| `list_artifacts`         | `artifactService.listArtifacts(taskId)`                   | Active-task fallback                                  |
| `get_artifact`           | `artifactService.getArtifact(taskId, typeId)`             | Active-task fallback; returns template if file absent |
| `update_artifact`        | `artifactService.updateArtifact(taskId, typeId, content)` | Active-task fallback                                  |
| `list_artifact_types`    | `artifactRegistry.getTypes()`                             | No params                                             |
| `register_artifact_type` | `artifactRegistry.registerAndPersistType(wr, type)`       | Validates id/displayName/description                  |

All tool handlers follow the standard response shape:
- **Success**: `{ content: [{ type: 'text', text: string }] }`
- **Error**: `{ content: [{ type: 'text', text: string }], isError: true }`

### Step 4 – Validation
- `npm run compile` in `packages/mcp` → ✅ zero TypeScript errors
- Runtime smoke test with `TASKLIST_WORKSPACE=/tmp/...` → ✅ `tasklist-mcp-server is running via stdio`

## Output
- **Modified**: `packages/mcp/src/index.ts` — orchestrator (side-effect imports + transport)
- **Created**: `packages/mcp/src/server.ts` — singleton `McpServer`
- **Created**: `packages/mcp/src/workspaceRoot.ts` — workspace root + service singletons
- **Created**: `packages/mcp/src/tools/tasks.ts` — 6 task tools
- **Created**: `packages/mcp/src/tools/artifacts.ts` — 5 artifact tools

## Issues
None.

## Important Findings
- **`server.tool()` vs `server.registerTool()`**: The MCP SDK's `McpServer` class exposes `server.tool()` as the idiomatic registration method in the current SDK version (^1.6.1). The mcp-builder skill reference guide documents `server.registerTool()` from an older API. Both work, but `server.tool()` is what the TypeScript types expose and what compiles cleanly.
- **`ArtifactRegistry.extensionRoot` is unused in MCP context**: As documented in `workspaceRoot.ts`, `initialize()` resolves built-in templates via `__dirname` of the CJS core module, not from the `extensionRoot` constructor argument. This is a latent quirk in the core API — the `extensionRoot` parameter could be removed or clarified in a future refactor.
- **`deactivate_task` is no-arg in core, but extension kept `taskId` in schema for consistency**: In the MCP tool I registered it with an empty schema (`{}`) — cleaner and more honest since the argument is truly unused.

## Next Steps
- Task 2.3 (if planned): Add end-to-end tests for the MCP tools using the MCP Inspector or a mock transport.
- Consider adding a `get_active_task` convenience tool (wraps `taskManager.getActiveTask()`) to let agents query the current active task without listing all tasks.
- The `TASKLIST_WORKSPACE` env var convention should be documented in the package README for MCP client configuration.
