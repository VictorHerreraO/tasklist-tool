/**
 * Workspace root resolution and shared service instances.
 *
 * All services are instantiated once per server process. Tool modules import
 * the ready-made service instances from this module rather than constructing
 * their own.
 *
 * Workspace root precedence:
 *   1. `TASKLIST_WORKSPACE` environment variable (absolute path)
 *   2. `process.cwd()` (current working directory at server start)
 */

import { TaskManager, ArtifactRegistry, ArtifactService } from '@tasklist/core';

/**
 * Resolves the workspace root from the TASKLIST_WORKSPACE environment variable.
 *
 * This is a STRICT REQUIREMENT. The MCP server will not start without this
 * variable set, ensuring it always operates on a valid, intentional path.
 *
 * @throws {Error} If TASKLIST_WORKSPACE is not set.
 */
function resolveWorkspaceRoot(): string {
    const envRoot = process.env['TASKLIST_WORKSPACE'];

    if (!envRoot) {
        throw new Error(
            'Missing TASKLIST_WORKSPACE environment variable. ' +
            'The Tasklist MCP server requires this variable to be set to the absolute path ' +
            'of the project workspace it should manage.\n\n' +
            'Example for shell:\n  export TASKLIST_WORKSPACE=$(pwd)\n\n' +
            'Example for Claude Desktop config:\n  "env": { "TASKLIST_WORKSPACE": "/path/to/project" }'
        );
    }

    return envRoot;
}

/** Absolute path to the workspace root that all services operate on. */
export const workspaceRoot: string = resolveWorkspaceRoot();

/** Handles all task lifecycle operations (create, list, start, close, etc.). */
export const taskManager = new TaskManager(workspaceRoot);

/**
 * Registry of artifact type definitions (both built-in and workspace-level).
 *
 * `initialize()` is synchronous and loads `.ai.md` template files from:
 *   - Built-in: resolved via `__dirname` inside the CJS-compiled core module
 *     (the `extensionRoot` argument is stored internally but `initialize()`
 *      uses the module's own `__dirname`, so any string is acceptable here)
 *   - Workspace: `{workspaceRoot}/.tasks/templates/`
 */
export const artifactRegistry = new ArtifactRegistry(workspaceRoot, workspaceRoot);
artifactRegistry.initialize();

/** Provides read/write access to artifact files for a given task. */
export const artifactService = new ArtifactService(
    workspaceRoot,
    taskManager,
    artifactRegistry
);
