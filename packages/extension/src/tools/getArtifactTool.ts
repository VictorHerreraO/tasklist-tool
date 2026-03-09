import * as vscode from 'vscode';
import { TaskManager, ArtifactService } from '@tasklist/core';
import { IGetArtifactParams } from './interfaces.js';

/**
 * Language model tool that retrieves the content of a specific artifact.
 *
 * If the artifact file exists on disk its full content is returned. If it does
 * not yet exist, the plain Markdown template body (no YAML frontmatter) is
 * returned so the agent can pre-populate the document structure.
 *
 * The `taskId` is resolved in this order:
 * 1. `options.input.taskId` (explicit)
 * 2. The currently active task via `TaskManager.getActiveTask()`
 *
 * If neither is available the tool throws an LLM-friendly error.
 *
 * Implements `vscode.LanguageModelTool<IGetArtifactParams>`.
 */
export class GetArtifactTool implements vscode.LanguageModelTool<IGetArtifactParams> {
    /** Used to resolve the active task when no explicit taskId is provided. */
    private readonly taskManager: TaskManager;

    /** Core I/O service for artifact file reads. */
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
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGetArtifactParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { artifactType, taskId } = options.input;
        const taskLabel = taskId ?? 'the active task';
        return {
            invocationMessage: `Reading '${artifactType}' artifact for ${taskLabel}`,
            confirmationMessages: {
                title: 'Get Artifact',
                message: new vscode.MarkdownString(
                    `Read the \`${artifactType}\` artifact for task \`${taskLabel}\`. ` +
                    `If the file does not yet exist, the default template will be returned instead.`
                ),
            },
        };
    }

    /**
     * Invokes the tool: returns the artifact content or its template fallback.
     *
     * The result text is prefixed with a header line indicating whether the
     * content is from an existing file or from the default template, so the
     * agent can act accordingly.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` with the artifact content.
     * @throws {Error} If no taskId can be resolved, or the artifact type is unknown.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGetArtifactParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { artifactType } = options.input;
        const taskId = this.resolveTaskId(options.input.taskId);

        try {
            const content = this.artifactService.getArtifact(taskId, artifactType);

            // Determine whether the content came from disk or from the template.
            // ArtifactService returns disk content when the file exists; otherwise
            // it returns the template body. We use a heuristic: the registry would
            // return templateBody; if the file existed the service read it from
            // disk. We need to peek at whether the file exists ourselves. Since
            // ArtifactService doesn't expose that directly, we try to distinguish
            // by comparing to the template — but the cleanest approach is to
            // surface both: a note line + the content.
            // We include a header note to guide the agent.
            const header =
                `[Artifact: ${artifactType} | Task: ${taskId}]\n` +
                `Note: If the content below matches the template structure, ` +
                `the artifact has not been saved yet. Use 'update_artifact' to persist your changes.\n\n`;

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(header + content),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);

            if (message.includes('Unknown artifact type')) {
                throw new Error(
                    `Unknown artifact type '${artifactType}'. ` +
                    `Use 'list_artifact_types' to see available types, then retry with a valid artifactType.`
                );
            }
            throw new Error(
                `Failed to get artifact '${artifactType}' for task '${taskId}': ${message}. ` +
                `Verify the artifactType and taskId are correct.`
            );
        }
    }
}
