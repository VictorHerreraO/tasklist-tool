import * as vscode from 'vscode';
import { TaskManager } from '@tasklist/core';
import { ITaskIdParams } from './interfaces.js';

/**
 * Language model tool that transitions a task from `in-progress` to `closed`.
 *
 * Only tasks in `in-progress` status can be closed. A task must have been
 * started with `start_task` before it can be closed. Attempting to close a
 * task in any other state will throw with an LLM-friendly error message.
 *
 * Implements `vscode.LanguageModelTool<ITaskIdParams>`.
 */
export class CloseTaskTool implements vscode.LanguageModelTool<ITaskIdParams> {
    /** The underlying service used to transition the task status. */
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
        options: vscode.LanguageModelToolInvocationPrepareOptions<ITaskIdParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { taskId } = options.input;
        return {
            invocationMessage: `Closing task '${taskId}'`,
            confirmationMessages: {
                title: 'Close Task',
                message: new vscode.MarkdownString(
                    `Transition task \`${taskId}\` from status \`in-progress\` → \`closed\`. ` +
                    `The task must currently be in \`in-progress\` status.`
                ),
            },
        };
    }

    /**
     * Invokes the tool: transitions the specified task to `closed`.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` confirming the status transition.
     * @throws {Error} If the task does not exist or is not in `in-progress` status.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ITaskIdParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskId } = options.input;

        try {
            const entry = this.taskManager.close_task(taskId);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Task '${entry.id}' has been closed. Status is now '${entry.status}'.`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);

            if (message.includes('not found')) {
                throw new Error(
                    `Cannot close task '${taskId}': task not found. ` +
                    `Use 'list_tasks' to see available tasks, then retry with a valid taskId.`
                );
            }
            if (message.includes('expected \'in-progress\'')) {
                throw new Error(
                    `Cannot close task '${taskId}': ${message} ` +
                    `Only tasks in 'in-progress' status can be closed. ` +
                    `If the task is 'open', call 'start_task' first.`
                );
            }
            throw new Error(
                `Failed to close task '${taskId}': ${message}. ` +
                `Verify the taskId is correct and the workspace index is accessible.`
            );
        }
    }
}
