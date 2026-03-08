import * as vscode from 'vscode';
import { TaskManager } from '../services/taskManager.js';
import { ITaskIdParams } from './interfaces.js';

/**
 * Language model tool that clears the currently active task in the workspace.
 *
 * After invocation no task will be active. The operation is idempotent —
 * it succeeds even if no task is currently active.
 *
 * The `taskId` field in {@link ITaskIdParams} is accepted but ignored at
 * runtime because `TaskManager.deactivateTask()` takes no argument. It is
 * retained in the interface for schema consistency.
 *
 * Implements `vscode.LanguageModelTool<ITaskIdParams>`.
 */
export class DeactivateTaskTool implements vscode.LanguageModelTool<ITaskIdParams> {
    /** The underlying service used to clear the active task pointer. */
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
     * @param _options - Invocation prepare options (input not used here).
     * @param _token - Cancellation token (unused here).
     * @returns Confirmation metadata for the VS Code tool-calling UI.
     */
    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<ITaskIdParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Deactivating the current task',
            confirmationMessages: {
                title: 'Deactivate Task',
                message: new vscode.MarkdownString(
                    'Clear the currently active task. No task will be active after this operation.'
                ),
            },
        };
    }

    /**
     * Invokes the tool: clears the active task pointer in the workspace index.
     *
     * @param _options - Invocation options (input not used here).
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` confirming the deactivation.
     * @throws {Error} If the operation unexpectedly fails.
     */
    async invoke(
        _options: vscode.LanguageModelToolInvocationOptions<ITaskIdParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            this.taskManager.deactivateTask();
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    'The active task has been cleared. No task is currently active.'
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(
                `Failed to deactivate task: ${message}. ` +
                `Ensure the workspace index is accessible and try again.`
            );
        }
    }
}
