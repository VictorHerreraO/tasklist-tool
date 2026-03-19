import * as vscode from 'vscode';
import { TaskManager } from '@tasklist/core';
import { ITaskIdParams } from './interfaces.js';
import { mapToolError } from './toolUtils.js';

/**
 * Language model tool that transitions a task from `open` to `in-progress`.
 *
 * Only tasks in `open` status can be started. Attempting to start a task in
 * any other state will throw with an LLM-friendly error message.
 *
 * Implements `vscode.LanguageModelTool<ITaskIdParams>`.
 */
export class StartTaskTool implements vscode.LanguageModelTool<ITaskIdParams> {
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
        const { taskId, parentTaskId } = options.input;
        const parentLabel = parentTaskId ? ` in project '${parentTaskId}'` : '';
        return {
            invocationMessage: `Starting task '${taskId}'${parentLabel}`,
            confirmationMessages: {
                title: 'Start Task',
                message: new vscode.MarkdownString(
                    `Transition task \`${taskId}\`${parentLabel} from status \`open\` → \`in-progress\`. ` +
                    `The task must currently be in \`open\` status.`
                ),
            },
        };
    }

    /**
     * Invokes the tool: transitions the specified task to `in-progress`.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` confirming the status transition.
     * @throws {Error} If the task does not exist or is not in `open` status.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ITaskIdParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskId, parentTaskId } = options.input;

        try {
            const entry = this.taskManager.start_task(taskId, parentTaskId);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Task '${entry.id}' has been started. Status is now '${entry.status}'.`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('expected \'open\'')) {
                throw new Error(
                    `Cannot start task '${taskId}': ${message} ` +
                    `Only tasks in 'open' status can be started. ` +
                    `Use 'list_tasks' to inspect the task's current status.`
                );
            }
            throw mapToolError(err, taskId, 'start task');
        }
    }
}
