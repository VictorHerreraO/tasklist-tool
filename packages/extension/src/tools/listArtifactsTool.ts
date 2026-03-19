import * as vscode from 'vscode';
import { TaskManager, ArtifactService } from '@tasklist/core';
import { IListArtifactsParams } from './interfaces.js';
import { resolveTaskContext, mapToolError } from './toolUtils.js';

/**
 * Language model tool that lists all artifacts for a given task.
 *
 * For every registered artifact type the tool reports whether the corresponding
 * file already exists on disk (`✔`) or is only available as a template (`○`).
 *
 * The `taskId` is resolved in this order:
 * 1. `options.input.taskId` (explicit)
 * 2. The currently active task via `TaskManager.getActiveTask()`
 *
 * If neither is available the tool throws an LLM-friendly error.
 *
 * Implements `vscode.LanguageModelTool<IListArtifactsParams>`.
 */
export class ListArtifactsTool implements vscode.LanguageModelTool<IListArtifactsParams> {
    /** Used to resolve the active task when no explicit taskId is provided. */
    private readonly taskManager: TaskManager;

    /** Core I/O service for artifact file inspection. */
    private readonly artifactService: ArtifactService;

    /**
     * @param taskManager - The `TaskManager` instance for the active workspace.
     * @param artifactService - The `ArtifactService` instance for this workspace.
     */
    constructor(taskManager: TaskManager, artifactService: ArtifactService) {
        this.taskManager = taskManager;
        this.artifactService = artifactService;
    }

    /**
     * Returns a confirmation message shown to the user before the tool runs.
     *
     * @param options - Invocation prepare options including the raw input.
     * @param _token - Cancellation token (unused here).
     * @returns Confirmation metadata for the VS Code tool-calling UI.
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IListArtifactsParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { taskId, parentTaskId } = options.input;
        const taskLabel = taskId ?? 'the active task';
        const parentLabel = parentTaskId ? ` in project '${parentTaskId}'` : '';
        return {
            invocationMessage: `Listing artifacts for ${taskLabel}${parentLabel}`,
            confirmationMessages: {
                title: 'List Artifacts',
                message: new vscode.MarkdownString(
                    `List all artifact types and their on-disk status for task \`${taskLabel}\`${parentLabel}.`
                ),
            },
        };
    }

    /**
     * Invokes the tool: lists all artifact types and their on-disk status for
     * the resolved task.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` with a formatted artifact status list.
     * @throws {Error} If no taskId can be resolved, or the task does not exist.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IListArtifactsParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskId, parentTaskId } = resolveTaskContext(this.taskManager, options.input.taskId, options.input.parentTaskId);

        try {
            const infos = this.artifactService.listArtifacts(taskId, parentTaskId);

            const lines = infos.map(
                info =>
                    `${info.exists ? '✔' : '○'} **${info.type.id}** (${info.type.filename}) — ${info.exists ? 'exists on disk' : 'template only'}`
            );

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Artifacts for task '${taskId}'${parentTaskId ? ` in project '${parentTaskId}'` : ''}:\n\n${lines.join('\n')}\n\n` +
                    `✔ = file saved on disk | ○ = template available, no file yet`
                ),
            ]);
        } catch (err: unknown) {
            throw mapToolError(err, taskId, 'list artifacts');
        }
    }
}
