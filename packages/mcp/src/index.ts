#!/usr/bin/env node
/**
 * MCP Server for Tasklist Tool — entry point.
 *
 * This module is the orchestrator:
 *   1. Imports tool modules (side effects) so all tools are registered on
 *      the shared `server` instance before the transport connects.
 *   2. Connects the server to a StdioServerTransport and starts listening.
 *
 * Tool registrations live in:
 *   - src/tools/tasks.ts     (list_tasks, create_task, activate_task,
 *                             deactivate_task, start_task, close_task)
 *   - src/tools/artifacts.ts (list_artifacts, get_artifact, update_artifact,
 *                             list_artifact_types, register_artifact_type)
 *
 * Workspace root is resolved in src/workspaceRoot.ts from the
 * TASKLIST_WORKSPACE environment variable or process.cwd().
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { server } from './server.js';

// ── Side-effect imports — register all tools before connecting ────────────────
import './tools/tasks.js';
import './tools/artifacts.js';

// ─── Transport ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log to stderr so it does not pollute the STDIO protocol channel.
    process.stderr.write('tasklist-mcp-server is running via stdio\n');
}

main().catch((error: unknown) => {
    process.stderr.write(
        `Fatal error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
});
