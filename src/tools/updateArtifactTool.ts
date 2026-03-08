import * as vscode from 'vscode';
import { TaskManager } from '../services/taskManager.js';
import { ArtifactService } from '../services/artifactService.js';
import { IUpdateArtifactParams } from './interfaces.js';

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
     * Resolves the effective task ID from explicit input or the active task.
     *
     * @param taskId - The optional task ID from the tool input.
     * @returns The resolved task ID.
     * @throws {Error} If no taskId is supplied and no task is currently active.
     */
    private resolveTaskId(taskId?: string): string {
        if (taskId) {
            return taskId;
        }
        const active = this.taskManager.getActiveTask();
        if (!active) {
            throw new Error(
                'No taskId was provided and there is no currently active task. ' +
                'Pass an explicit taskId or activate a task first using `activate_task`.'
            );
        }
        return active.id;
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
        const { artifactType, taskId } = options.input;
        const taskLabel = taskId ?? 'the active task';
        return {
            invocationMessage: `Saving '${artifactType}' artifact for ${taskLabel}`,
            confirmationMessages: {
                title: 'Update Artifact',
                message: new vscode.MarkdownString(
                    `Write (create or overwrite) the \`${artifactType}\` artifact ` +
                    `for task \`${taskLabel}\`. **This will replace any existing file content.**`
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
        const taskId = this.resolveTaskId(options.input.taskId);

        try {
            this.artifactService.updateArtifact(taskId, artifactType, content);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Artifact '${artifactType}' for task '${taskId}' has been saved successfully.`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);

            if (message.includes('not found')) {
                throw new Error(
                    `Cannot update artifact: task '${taskId}' not found. ` +
                    `Use 'list_tasks' to find valid task IDs or 'create_task' to create a new one.`
                );
            }
            if (message.includes('Unknown artifact type')) {
                throw new Error(
                    `Unknown artifact type '${artifactType}'. ` +
                    `Use 'list_artifact_types' to see valid types, then retry with a correct artifactType.`
                );
            }
            throw new Error(
                `Failed to update artifact '${artifactType}' for task '${taskId}': ${message}. ` +
                `Ensure the workspace is writable and the task and artifact type both exist.`
            );
        }
    }
}
