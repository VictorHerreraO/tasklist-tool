---
agent: Agent_MCP
task_ref: Task 2.1 - MCP Server Scaffolding
status: Completed
ad_hoc_delegation: false
compatibility_issues: true
important_findings: true
---

# Task Log: Task 2.1 - MCP Server Scaffolding

## Summary
Initialized a functional MCP server framework within `packages/mcp` using `@modelcontextprotocol/sdk` over STDIO. The server compiles cleanly with TypeScript and starts successfully; it is ready to accept tool registrations in Task 2.2.

## Details
- Reviewed `packages/core/package.json`: package name is `@tasklist/core`, compiled output lands in `out/`, no `"type": "module"` (CommonJS-compatible). Root tsconfig uses `module: NodeNext`.
- Reviewed `packages/core/src/index.ts`: exports `TaskManager`, `ArtifactRegistry`, `ArtifactService`, `Task`, and `Artifact` models — the full surface Task 2.2 will consume.
- Reviewed existing `packages/mcp/package.json` (scaffolded by Agent_Extension): only had `@tasklist/core` as a dependency with no MCP SDK.
- **Decision — ESM for MCP package**: Added `"type": "module"` to `packages/mcp/package.json`. The MCP SDK is ESM-first and the STDIO transport uses `process.stdin`/`process.stdout` directly, so ESM is the correct choice. `@tasklist/core` is compatible because it is resolved via the npm workspace and the compiled `.js` files are consumed directly.
- **Decision — Standalone tsconfig**: The MCP `tsconfig.json` no longer extends the monorepo root. The root tsconfig sets `rootDir: "src"` which conflicts when each package has its own `src/` tree. The MCP package uses `module: NodeNext`, `target: ES2022`, consistent with the SDK's requirements.
- Installed `@modelcontextprotocol/sdk ^1.6.1` and `zod ^3.23.8` (MCP SDK peer dep and tool schema library).
- Implemented `packages/mcp/src/index.ts` using `McpServer` + `StdioServerTransport`. Exports `server` so tool-registration modules added in Task 2.2 can call `server.registerTool()` before the server connects.
- Created `packages/mcp/bin/tasklist-mcp` (shebang wrapper) as the `bin` entry point.
- Ran `npm install` at monorepo root, then `npm run compile` in `packages/mcp` — both succeeded with no errors.
- Smoke-tested: launched `node packages/mcp/out/index.js` and confirmed stderr output `tasklist-mcp-server is running via stdio`.

## Output
- **Modified**: `packages/mcp/package.json` — added MCP SDK, zod, bin entry, ESM type, start/build/dev scripts
- **Modified**: `packages/mcp/tsconfig.json` — standalone (no extends), NodeNext module, ES2022 target
- **Created**: `packages/mcp/src/index.ts` — MCP server entry point (McpServer + StdioServerTransport, exports `server`)
- **Created**: `packages/mcp/bin/tasklist-mcp` — executable bin wrapper

Key snippet from `src/index.ts`:
```typescript
export const server = new McpServer({
    name: 'tasklist-mcp-server',
    version: '0.0.1',
});

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write('tasklist-mcp-server is running via stdio\n');
}
```

## Issues
None — TypeScript compilation and runtime smoke test both passed cleanly.

## Compatibility Concerns
- **`packages/core` is CommonJS, `packages/mcp` is ESM**: This is intentional and safe because `@tasklist/core` compiles to `.js` files and is consumed via the npm workspace symlink exactly as any other third-party package would be. Node's interop between CJS and ESM works correctly in this direction (ESM can import CJS). However, Task 2.2 must import from `@tasklist/core` using static ESM `import` syntax (not `require`).
- **`packages/mcp/tsconfig.json` is now standalone**: It no longer extends the root tsconfig. This was necessary because the root `tsconfig.json` sets `rootDir: "src"` as an absolute path reference that causes type errors in sub-packages. Future packages added to the monorepo should follow this same pattern or the root tsconfig should be refactored to remove `rootDir`/`outDir`.

## Important Findings
- **Tool registration hook**: `server` is exported from `packages/mcp/src/index.ts`. Task 2.2 should **not** create a new McpServer; instead it should import `{ server }` from `./index.js` (or from a dedicated `./server.js` module extracted from index). If Task 2.2 registers tools in separate files, the current design means those files must be imported before `server.connect()` runs. A clean pattern for Task 2.2 would be to extract server instantiation to `src/server.ts`, import it in tool files, and then import all tool modules in `src/index.ts` before calling `main()`.
- **No API key / environment validation needed**: Unlike external API MCP servers, this server wraps `@tasklist/core` which only requires a workspace root path. Authentication is local filesystem access. Task 2.2 will need to determine how the workspace root path is passed to `TaskManager` (likely via a CLI arg or env var).

## Next Steps
- Task 2.2: Register tools by importing `{ server }` from the server module. Consider refactoring `src/index.ts` into `src/server.ts` (exports `server`) + `src/index.ts` (imports tools, then calls `main()`).
- Determine mechanism for passing workspace root to `TaskManager` — recommend `TASKLIST_WORKSPACE` env var or `--workspace` CLI argument.
