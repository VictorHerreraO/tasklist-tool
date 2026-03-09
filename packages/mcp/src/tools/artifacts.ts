/**
 * MCP tool registrations for artifact management.
 *
 * Registers 5 tools against the shared `server` instance:
 *   - list_artifacts
 *   - get_artifact
 *   - update_artifact
 *   - list_artifact_types
 *   - register_artifact_type
 *
 * Import this module as a side effect (no named exports used) so that
 * tool registrations run before the server connects to its transport.
 */

import { z } from 'zod';
import { ArtifactType } from '@tasklist/core';
import { server } from '../server.js';
import { workspaceRoot, taskManager, artifactService, artifactRegistry } from '../workspaceRoot.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Converts an unknown caught value to a plain error string. */
function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Standard MCP error response. */
function errorResult(message: string) {
    return {
        content: [{ type: 'text' as const, text: message }],
        isError: true,
    };
}

/**
 * Resolves the effective task ID: explicit input first, then active task.
 * Throws an LLM-friendly error if neither is available.
 */
function resolveTaskId(taskId: string | undefined): string {
    if (taskId) {
        return taskId;
    }
    const active = taskManager.getActiveTask();
    if (!active) {
        throw new Error(
            'No taskId was provided and there is no currently active task. ' +
            'Pass an explicit taskId or activate a task first using `activate_task`.'
        );
    }
    return active.id;
}

// ─── Tool: list_artifacts ────────────────────────────────────────────────────

server.tool(
    'list_artifacts',
    'List all artifact types for a given task and show whether each artifact file exists on disk. ' +
    '✔ = file saved on disk | ○ = template available, no file yet. ' +
    'If taskId is omitted, the currently active task is used.',
    {
        taskId: z
            .string()
            .optional()
            .describe('ID of the task whose artifacts to list. Defaults to the active task.'),
    },
    async ({ taskId }) => {
        let resolvedId: string;
        try {
            resolvedId = resolveTaskId(taskId);
        } catch (err: unknown) {
            return errorResult(toErrorMessage(err));
        }

        try {
            const infos = artifactService.listArtifacts(resolvedId);

            const lines = infos.map(
                info =>
                    `${info.exists ? '✔' : '○'} **${info.type.id}** (${info.type.filename}) — ${info.exists ? 'exists on disk' : 'template only'}`
            );

            return {
                content: [{
                    type: 'text',
                    text:
                        `Artifacts for task '${resolvedId}':\n\n${lines.join('\n')}\n\n` +
                        `✔ = file saved on disk | ○ = template available, no file yet`,
                }],
            };
        } catch (err: unknown) {
            const message = toErrorMessage(err);
            if (message.includes('not found')) {
                return errorResult(
                    `Task '${resolvedId}' not found. ` +
                    `Use 'list_tasks' to see available tasks, then retry with a valid taskId.`
                );
            }
            return errorResult(
                `Failed to list artifacts for task '${resolvedId}': ${message}. ` +
                `Ensure the workspace is accessible and the task exists.`
            );
        }
    }
);

// ─── Tool: get_artifact ──────────────────────────────────────────────────────

server.tool(
    'get_artifact',
    'Retrieve the content of a specific artifact for a task. ' +
    'If the artifact file exists on disk its full content is returned. ' +
    'If it does not yet exist, the plain Markdown template body is returned so you can pre-populate it. ' +
    'Use update_artifact to persist changes. ' +
    'If taskId is omitted, the currently active task is used.',
    {
        artifactType: z
            .string()
            .min(1)
            .describe('ID of the artifact type to retrieve (e.g. "research", "walkthrough"). Use list_artifact_types to discover available IDs.'),
        taskId: z
            .string()
            .optional()
            .describe('ID of the task the artifact belongs to. Defaults to the active task.'),
    },
    async ({ artifactType, taskId }) => {
        let resolvedId: string;
        try {
            resolvedId = resolveTaskId(taskId);
        } catch (err: unknown) {
            return errorResult(toErrorMessage(err));
        }

        try {
            const content = artifactService.getArtifact(resolvedId, artifactType);

            const header =
                `[Artifact: ${artifactType} | Task: ${resolvedId}]\n` +
                `Note: If the content below matches the template structure, ` +
                `the artifact has not been saved yet. Use 'update_artifact' to persist your changes.\n\n`;

            return {
                content: [{ type: 'text', text: header + content }],
            };
        } catch (err: unknown) {
            const message = toErrorMessage(err);
            if (message.includes('Unknown artifact type')) {
                return errorResult(
                    `Unknown artifact type '${artifactType}'. ` +
                    `Use 'list_artifact_types' to see available types, then retry with a valid artifactType.`
                );
            }
            return errorResult(
                `Failed to get artifact '${artifactType}' for task '${resolvedId}': ${message}. ` +
                `Verify the artifactType and taskId are correct.`
            );
        }
    }
);

// ─── Tool: update_artifact ───────────────────────────────────────────────────

server.tool(
    'update_artifact',
    'Create or overwrite an artifact file for a task. ' +
    'Writes the provided Markdown content to .tasks/{taskId}/{filename}. ' +
    'If the file does not yet exist it is created; if it does it is fully replaced. ' +
    'If taskId is omitted, the currently active task is used.',
    {
        artifactType: z
            .string()
            .min(1)
            .describe('ID of the artifact type to create or overwrite (e.g. "research"). Use list_artifact_types to discover valid IDs.'),
        content: z
            .string()
            .describe('Full Markdown content for the artifact (no YAML frontmatter). This completely replaces any existing file content.'),
        taskId: z
            .string()
            .optional()
            .describe('ID of the task the artifact belongs to. Defaults to the active task.'),
    },
    async ({ artifactType, content, taskId }) => {
        let resolvedId: string;
        try {
            resolvedId = resolveTaskId(taskId);
        } catch (err: unknown) {
            return errorResult(toErrorMessage(err));
        }

        try {
            artifactService.updateArtifact(resolvedId, artifactType, content);
            return {
                content: [{
                    type: 'text',
                    text: `Artifact '${artifactType}' for task '${resolvedId}' has been saved successfully.`,
                }],
            };
        } catch (err: unknown) {
            const message = toErrorMessage(err);
            if (message.includes('not found')) {
                return errorResult(
                    `Cannot update artifact: task '${resolvedId}' not found. ` +
                    `Use 'list_tasks' to find valid task IDs or 'create_task' to create a new one.`
                );
            }
            if (message.includes('Unknown artifact type')) {
                return errorResult(
                    `Unknown artifact type '${artifactType}'. ` +
                    `Use 'list_artifact_types' to see valid types, then retry with a correct artifactType.`
                );
            }
            return errorResult(
                `Failed to update artifact '${artifactType}' for task '${resolvedId}': ${message}. ` +
                `Ensure the workspace is writable and the task and artifact type both exist.`
            );
        }
    }
);

// ─── Tool: list_artifact_types ───────────────────────────────────────────────

server.tool(
    'list_artifact_types',
    'List all registered artifact types, including built-in and any custom types. ' +
    'Returns each type\'s id, displayName, description, and expected filename. ' +
    'Use this to discover which IDs are valid for get_artifact, update_artifact, and register_artifact_type.',
    {},
    async () => {
        try {
            const types = artifactRegistry.getTypes();

            if (types.length === 0) {
                return {
                    content: [{
                        type: 'text',
                        text:
                            'No artifact types are currently registered. ' +
                            'Use `register_artifact_type` to add a custom type.',
                    }],
                };
            }

            const lines = types.map(
                t =>
                    `- **${t.id}** (${t.filename})\n` +
                    `  Display name: ${t.displayName}\n` +
                    `  Description:  ${t.description}`
            );

            return {
                content: [{
                    type: 'text',
                    text: `${types.length} artifact type(s) registered:\n\n${lines.join('\n\n')}`,
                }],
            };
        } catch (err: unknown) {
            return errorResult(
                `Failed to list artifact types: ${toErrorMessage(err)}. ` +
                `Ensure the registry has been initialized and try again.`
            );
        }
    }
);

// ─── Tool: register_artifact_type ────────────────────────────────────────────

server.tool(
    'register_artifact_type',
    'Register a new custom artifact type. ' +
    'The type is persisted to .tasks/templates/{id}.ai.md in the workspace root ' +
    'and is immediately available in-memory. ' +
    'Use this when the standard built-in types do not cover a required document format. ' +
    'Built-in types: research, walkthrough, task-details, review, implementation-plan.',
    {
        id: z
            .string()
            .min(1)
            .describe('Unique identifier for the new artifact type (e.g. "sprint-retro"). Must be URL-friendly (lowercase, hyphens). Determines the filename: {id}.ai.md.'),
        displayName: z
            .string()
            .min(1)
            .describe('Human-friendly display name shown in listings (e.g. "Sprint Retrospective").'),
        description: z
            .string()
            .min(1)
            .describe('Short description of what this artifact type should contain. Used to decide when to use this type.'),
        templateBody: z
            .string()
            .optional()
            .describe('Optional Markdown body to use as the default template. When omitted, an empty template is used.'),
    },
    async ({ id, displayName, description, templateBody }) => {
        if (!id || id.trim() === '') {
            return errorResult(
                'A non-empty `id` is required for the artifact type (e.g. "sprint-retro"). ' +
                'Use a URL-friendly, lowercase identifier.'
            );
        }
        if (!displayName || displayName.trim() === '') {
            return errorResult('A non-empty `displayName` is required (e.g. "Sprint Retrospective").');
        }
        if (!description || description.trim() === '') {
            return errorResult('A non-empty `description` is required to help the LLM know when to use this type.');
        }

        const filename = `${id}.ai.md`;
        const newType: ArtifactType = {
            id,
            displayName,
            description,
            filename,
            templateBody: templateBody ?? '',
        };

        try {
            artifactRegistry.registerAndPersistType(workspaceRoot, newType);
            return {
                content: [{
                    type: 'text',
                    text:
                        `Artifact type '${id}' registered successfully.\n` +
                        `Template file: .tasks/templates/${filename}`,
                }],
            };
        } catch (err: unknown) {
            return errorResult(
                `Failed to register artifact type '${id}': ${toErrorMessage(err)}. ` +
                `Ensure the workspace root is writable and the id is a valid identifier.`
            );
        }
    }
);
