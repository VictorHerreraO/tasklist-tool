/**
 * Shared MCP server instance.
 *
 * This module creates and exports the single `McpServer` instance used
 * throughout the MCP package. Tool modules import `server` from here and
 * call `server.tool()` as a side effect when they are imported.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const server = new McpServer({
    name: 'tasklist-mcp-server',
    version: '0.3.3',
});
