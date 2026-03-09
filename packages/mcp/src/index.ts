#!/usr/bin/env node
/**
 * MCP Server for Tasklist Tool.
 *
 * This server exposes Tasklist Tool functionality (task management and artifact
 * tracking) to LLM clients via the Model Context Protocol (MCP) over STDIO.
 *
 * Tools are registered in subsequent tasks. This file provides the base server
 * infrastructure and startup logic.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// ---------------------------------------------------------------------------
// Server Initialization
// ---------------------------------------------------------------------------

/**
 * The core MCP server instance.
 *
 * Tools (registered in Task 2.2+) will call `server.registerTool()` on this
 * instance before the server connects to its transport.
 */
export const server = new McpServer({
    name: 'tasklist-mcp-server',
    version: '0.0.1',
});

// ---------------------------------------------------------------------------
// Transport – STDIO (for use with local MCP clients, e.g. Claude Desktop)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log to stderr so it does not pollute the STDIO protocol channel
    process.stderr.write('tasklist-mcp-server is running via stdio\n');
}

main().catch((error: unknown) => {
    process.stderr.write(
        `Fatal error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
});
