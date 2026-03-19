import * as vscode from 'vscode';
import { TaskManager, ArtifactService } from '@tasklist/core';
import { IUpdateArtifactParams } from './interfaces.js';
import { resolveTaskContext, mapToolError } from './toolUtils.js';

/**
 * Language model tool that creates or overwrites an artifact file for a task.
 *
 * Writes the provided Markdown content to `.tasks/{taskId}/{filename}`. If the
 * file does not yet exist it is created; if it does it is fully replaced.
 *
 * The `taskId` is resolved in this order:
 * 1. `options.input.taskId` (explicit)
 * 2. The currently active task via `TaskManager.getActiveTask()`
 *
 * If neither is available the tool throws an LLM-friendly error.
 *
 * Implements `vscode.LanguageModelTool<IUpdateArtifactParams>`.
 */
export class UpdateArtifactTool implements vscode.LanguageModelTool<IUpdateArtifactParams> {
    /** Used to resolve the active task when no explicit taskId is provided. */
    private readonly taskManager: TaskManager;

    /** Core I/O service for artifact file writes. */
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
        options: vscode.LanguageModelToolInvocationPrepareOptions<IUpdateArtifactParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { artifactType, taskId, parentTaskId } = options.input;
        const taskLabel = taskId ?? 'the active task';
        const parentLabel = parentTaskId ? ` in project '${parentTaskId}'` : '';
        return {
            invocationMessage: `Saving '${artifactType}' artifact for ${taskLabel}${parentLabel}`,
            confirmationMessages: {
                title: 'Update Artifact',
                message: new vscode.MarkdownString(
                    `Write (create or overwrite) the \`${artifactType}\` artifact ` +
                    `for task \`${taskLabel}\`${parentLabel}. **This will replace any existing file content.**`
                ),
            },
        };
    }

    /**
     * Invokes the tool: persists the artifact content to disk.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` confirming the write with task and type.
     * @throws {Error} If no taskId can be resolved, the task does not exist, or
     *   the artifact type is not registered.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IUpdateArtifactParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { artifactType, content } = options.input;
        const { taskId, parentTaskId } = resolveTaskContext(this.taskManager, options.input.taskId, options.input.parentTaskId);

        try {
            this.artifactService.updateArtifact(taskId, artifactType, content, parentTaskId);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Artifact '${artifactType}' for task '${taskId}'${parentTaskId ? ` in project '${parentTaskId}'` : ''} has been saved successfully.`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('Unknown artifact type')) {
                throw new Error(
                    `Unknown artifact type '${artifactType}'. ` +
                    `Use 'list_artifact_types' to see valid types, then retry with a correct artifactType.`
                );
            }
            throw mapToolError(err, taskId, `update artifact '${artifactType}'`);
        }
    }
}
