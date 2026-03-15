import * as vscode from 'vscode';
import { TaskManager } from '@tasklist/core';
import { IActivateTaskParams } from './interfaces.js';

/**
 * Language model tool that sets a task as the currently active task.
 *
 * Only one task can be active at a time. Activating a different task
 * automatically replaces the previous active task. The task must exist
 * in the workspace index.
 *
 * Implements `vscode.LanguageModelTool<IActivateTaskParams>`.
 */
export class ActivateTaskTool implements vscode.LanguageModelTool<IActivateTaskParams> {
    /** The underlying service used to persist the activation change. */
    private readonly taskManager: TaskManager;

    /**
     * @param taskManager - The `TaskManager` instance for the active workspace.
     */
    constructor(taskManager: TaskManager) {
        this.taskManager = taskManager;
    }

    /**
     * Returns a confirmation message shown to the user before the tool runs.
     *
     * @param options - Invocation prepare options including the raw input.
     * @param _token - Cancellation token (unused here).
     * @returns Confirmation metadata for the VS Code tool-calling UI.
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IActivateTaskParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { taskId, parentTaskId } = options.input;
        const parentLabel = parentTaskId ? ` in project '${parentTaskId}'` : '';
        return {
            invocationMessage: `Activating task '${taskId}'${parentLabel}`,
            confirmationMessages: {
                title: 'Activate Task',
                message: new vscode.MarkdownString(
                    `Set task \`${taskId}\`${parentLabel} as the currently active task. ` +
                    `Any previously active task will be deactivated.`
                ),
            },
        };
    }

    /**
     * Invokes the tool: marks the specified task as active in the workspace index.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` confirming the activation.
     * @throws {Error} If the task does not exist.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IActivateTaskParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskId, parentTaskId, activateProject } = options.input;

        try {
            this.taskManager.activateTask(taskId, parentTaskId, activateProject);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Task '${taskId}' is now the active task${parentTaskId ? ` in project '${parentTaskId}'` : ''}.`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('task not found')) {
                throw new Error(
                    `Cannot activate task '${taskId}': task not found. ` +
                    `AI Agent might have forgot to provide a parent project id. ` +
                    `Use 'list_tasks' to see available tasks, then retry with a valid taskId and parentTaskId if applicable.`
                );
            }
            throw new Error(
                `Failed to activate task '${taskId}': ${message}. ` +
                `Verify the taskId is correct and the workspace index is accessible.`
            );
        }
    }
}
