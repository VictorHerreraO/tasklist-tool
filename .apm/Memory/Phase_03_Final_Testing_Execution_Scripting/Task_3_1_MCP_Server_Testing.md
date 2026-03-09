# Task 3.1 — MCP Server Testing: Memory Log

**Status:** ✅ COMPLETE  
**Agent:** Agent_MCP  
**Date:** 2026-03-09

---

## Objective

Implement a comprehensive test suite for the MCP server layer (`packages/mcp`), covering all 11 tool handlers (6 task + 5 artifact), verifying correct input parsing, service delegation, and proper success/error response shaping. Ensure all tests pass before closing the task.

---

## Key Design Decision: Handler Extraction Refactor

**Problem:** The original `tasks.ts` / `artifacts.ts` tool implementations closed over module-level service singletons from `workspaceRoot.ts`. This made them impossible to unit-test in isolation — the singletons were created once at module-load time using the `TASKLIST_WORKSPACE` env var.

**Solution:** Extracted all handler logic into **pure, testable functions** in two new files:
- `src/handlers/taskHandlers.ts`
- `src/handlers/artifactHandlers.ts`

Each handler function accepts its dependencies (e.g., `TaskManager`, `ArtifactService`) as parameters rather than using singletons. The `src/tools/tasks.ts` and `src/tools/artifacts.ts` files were refactored into thin wrappers that pass the singletons to the handlers.

**Benefit:** Tests instantiate fresh services against temp directories per-test, achieving full isolation with zero env-var dependencies or module mocking.

---

## TypeScript Challenges & Solutions

### 1. `McpToolResult` Missing Index Signature
The MCP SDK's `Result` type requires `{ [x: string]: unknown }`. Adding this index signature to `McpToolResult` in `taskHandlers.ts` resolved all SDK compatibility errors in `tasks.ts` and `artifacts.ts`.

### 2. Discriminated Union for `resolveTaskId`
The `'isError' in resolved` discriminator failed with TypeScript's narrowing because `McpToolResult` has an index signature (all keys are valid). Replaced with a proper tagged union:
```typescript
type ResolvedId = { ok: true; id: string } | { ok: false; result: McpToolResult };
```

### 3. `tsconfig.json` — Removed `rootDir`
Removing `rootDir` and adding `"test/**/*"` to `include` allows `tsc` to compile both `src/` and `test/` into `out/`, mirroring the source tree structure.

### 4. Mocha TDD UI
The tests use `suite()` / `test()` (mocha's TDD interface), not `describe()` / `it()`. Added `.mocharc.json` with `"ui": "tdd"` to configure this globally.

---

## Test Setup

- **Framework:** Mocha v11 (TDD UI) + Node.js built-in `assert`
- **Test files:** `packages/mcp/test/tasks.test.ts`, `packages/mcp/test/artifacts.test.ts`
- **Config:** `packages/mcp/.mocharc.json` — `ui: tdd`, `spec: out/test/**/*.test.js`
- **Scripts:** `pretest: tsc -p ./`, `test: mocha`
- **Workspace isolation:** `fs.mkdtempSync` per test suite, torn down in `teardown()`

---

## Test Coverage Summary

### `test/tasks.test.ts` — 35 tests

| Handler                | Tests                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `handleListTasks`      | 8 (empty, all, filter-open, filter-ip, filter-closed, no-match, invalid-status, format)     |
| `handleCreateTask`     | 5 (success, status, persist, empty-id, duplicate)                                           |
| `handleActivateTask`   | 4 (success, persist, not-found, list_tasks hint)                                            |
| `handleDeactivateTask` | 3 (success-with-active, persist, idempotent)                                                |
| `handleStartTask`      | 7 (success, persist, not-found, list_tasks hint, ip-state, closed-state, hint)              |
| `handleCloseTask`      | 8 (success, persist, not-found, list_tasks hint, open-state, start_task hint, closed-state) |

### `test/artifacts.test.ts` — 33 tests

| Handler                      | Tests                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `handleListArtifactTypes`    | 4 (at-least-1, format, count-increase, built-in)                                                                    |
| `handleListArtifacts`        | 6 (explicit-id, template-only, file-exists, active-fallback, no-active, not-found)                                  |
| `handleGetArtifact`          | 6 (saved-content, header-format, update-hint, active-fallback, no-active, unknown-type)                             |
| `handleUpdateArtifact`       | 8 (success-msg, persist, overwrite, active-fallback, fallback-msg, no-active, not-found, unknown-type)              |
| `handleRegisterArtifactType` | 9 (persist-file, in-memory, success-msg, filename-msg, template-body, empty-body, empty-id, empty-name, empty-desc) |

**Total: 68 tests — all passing**

---

## File Manifest

### New files
- `packages/mcp/src/handlers/taskHandlers.ts`
- `packages/mcp/src/handlers/artifactHandlers.ts`
- `packages/mcp/test/tasks.test.ts`
- `packages/mcp/test/artifacts.test.ts`
- `packages/mcp/.mocharc.json`

### Modified files
- `packages/mcp/src/tools/tasks.ts` — refactored into thin delegation wrappers
- `packages/mcp/src/tools/artifacts.ts` — refactored into thin delegation wrappers
- `packages/mcp/tsconfig.json` — removed `rootDir`, added `test/**/*` to include
- `packages/mcp/package.json` — added mocha/types devDeps, pretest+test scripts

---

## Validation

```
> @tasklist/mcp@0.0.1 test
> mocha

  68 passing (133ms)
```

Runtime smoke test confirmed: `node out/src/index.js` — `tasklist-mcp-server is running via stdio`
