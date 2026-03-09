/**
 * MCP tool handler functions for artifact management.
 *
 * This module exports pure, testable handler functions for each artifact tool.
 * Each handler accepts only what it needs via parameters rather than closing
 * over module-level singletons — making them easy to unit-test with isolated
 * service instances.
 *
 * The server registrations in `artifacts.ts` import and delegate to these handlers.
 */

import { TaskManager, ArtifactRegistry, ArtifactService, ArtifactType } from '@tasklist/core';
import type { McpToolResult } from './taskHandlers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function errorResult(message: string): McpToolResult {
    return { content: [{ type: 'text', text: message }], isError: true };
}

function successResult(message: string): McpToolResult {
    return { content: [{ type: 'text', text: message }] };
}

// ─── Task ID resolution ───────────────────────────────────────────────────────

/** Discriminated union used to return either a resolved ID or an error result. */
type ResolvedId = { ok: true; id: string } | { ok: false; result: McpToolResult };

function resolveTaskId(
    manager: TaskManager,
    taskId: string | undefined
): ResolvedId {
    if (taskId) {
        return { ok: true, id: taskId };
    }
    const active = manager.getActiveTask();
    if (!active) {
        return {
            ok: false,
            result: errorResult(
                'No taskId was provided and there is no currently active task. ' +
                'Pass an explicit taskId or activate a task first using `activate_task`.'
            ),
        };
    }
    return { ok: true, id: active.id };
}

// ─── list_artifacts ──────────────────────────────────────────────────────────

export async function handleListArtifacts(
    manager: TaskManager,
    service: ArtifactService,
    input: { taskId?: string }
): Promise<McpToolResult> {
    const resolved = resolveTaskId(manager, input.taskId);
    if (!resolved.ok) { return resolved.result; }
    const resolvedId = resolved.id;

    try {
        const infos = service.listArtifacts(resolvedId);

        const lines = infos.map(
            info =>
                `${info.exists ? '✔' : '○'} **${info.type.id}** (${info.type.filename}) — ${info.exists ? 'exists on disk' : 'template only'}`
        );

        return successResult(
            `Artifacts for task '${resolvedId}':\n\n${lines.join('\n')}\n\n` +
            `✔ = file saved on disk | ○ = template available, no file yet`
        );
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

// ─── get_artifact ─────────────────────────────────────────────────────────────

export async function handleGetArtifact(
    manager: TaskManager,
    service: ArtifactService,
    input: { artifactType: string; taskId?: string }
): Promise<McpToolResult> {
    const resolved = resolveTaskId(manager, input.taskId);
    if (!resolved.ok) { return resolved.result; }
    const resolvedId = resolved.id;
    const { artifactType } = input;

    try {
        const content = service.getArtifact(resolvedId, artifactType);

        const header =
            `[Artifact: ${artifactType} | Task: ${resolvedId}]\n` +
            `Note: If the content below matches the template structure, ` +
            `the artifact has not been saved yet. Use 'update_artifact' to persist your changes.\n\n`;

        return successResult(header + content);
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

// ─── update_artifact ──────────────────────────────────────────────────────────

export async function handleUpdateArtifact(
    manager: TaskManager,
    service: ArtifactService,
    input: { artifactType: string; content: string; taskId?: string }
): Promise<McpToolResult> {
    const resolved = resolveTaskId(manager, input.taskId);
    if (!resolved.ok) { return resolved.result; }
    const resolvedId = resolved.id;
    const { artifactType, content } = input;

    try {
        service.updateArtifact(resolvedId, artifactType, content);
        return successResult(
            `Artifact '${artifactType}' for task '${resolvedId}' has been saved successfully.`
        );
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

// ─── list_artifact_types ──────────────────────────────────────────────────────

export async function handleListArtifactTypes(
    registry: ArtifactRegistry
): Promise<McpToolResult> {
    try {
        const types = registry.getTypes();

        if (types.length === 0) {
            return successResult(
                'No artifact types are currently registered. ' +
                'Use `register_artifact_type` to add a custom type.'
            );
        }

        const lines = types.map(
            t =>
                `- **${t.id}** (${t.filename})\n` +
                `  Display name: ${t.displayName}\n` +
                `  Description:  ${t.description}`
        );

        return successResult(`${types.length} artifact type(s) registered:\n\n${lines.join('\n\n')}`);
    } catch (err: unknown) {
        return errorResult(
            `Failed to list artifact types: ${toErrorMessage(err)}. ` +
            `Ensure the registry has been initialized and try again.`
        );
    }
}

// ─── register_artifact_type ───────────────────────────────────────────────────

export async function handleRegisterArtifactType(
    workspaceRoot: string,
    registry: ArtifactRegistry,
    input: {
        id: string;
        displayName: string;
        description: string;
        templateBody?: string;
    }
): Promise<McpToolResult> {
    const { id, displayName, description, templateBody } = input;

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
        registry.registerAndPersistType(workspaceRoot, newType);
        return successResult(
            `Artifact type '${id}' registered successfully.\n` +
            `Template file: .tasks/templates/${filename}`
        );
    } catch (err: unknown) {
        return errorResult(
            `Failed to register artifact type '${id}': ${toErrorMessage(err)}. ` +
            `Ensure the workspace root is writable and the id is a valid identifier.`
        );
    }
}
