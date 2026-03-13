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

import * as path from 'path';
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
 * Absolute path to the @tasklist/core package root, used for built-in templates.
 *
 * In an ESM environment (MCP), we use import.meta.resolve to find the package entry point.
 * The core package root is two levels up from out/index.js.
 */
const coreEntryPoint = import.meta.resolve('@tasklist/core').replace('file://', '');
const corePackageRoot = path.resolve(path.dirname(coreEntryPoint), '..');

/**
 * Registry of artifact type definitions (both built-in and workspace-level).
 *
 * `initialize()` is synchronous and loads `.ai.md` template files from:
 *   - Built-in: resolved via `corePackageRoot` (found dynamically via import.meta.resolve)
 *   - Workspace: `{workspaceRoot}/.tasks/templates/`
 */
export const artifactRegistry = new ArtifactRegistry(corePackageRoot, workspaceRoot);
artifactRegistry.initialize();

/** Provides read/write access to artifact files for a given task. */
export const artifactService = new ArtifactService(
    workspaceRoot,
    taskManager,
    artifactRegistry
);
