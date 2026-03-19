import * as vscode from 'vscode';
import { TaskManager } from '@tasklist/core';
import { ITaskIdParams } from './interfaces.js';
import { mapToolError } from './toolUtils.js';

/**
 * Language model tool that promotes an existing task to a project.
 *
 * Promoting a task changes its type to 'project', enabling it to contain
 * subtasks. It also initializes a nested task index directory.
 *
 * Implements `vscode.LanguageModelTool<ITaskIdParams>`.
 */
export class PromoteToProjectTool implements vscode.LanguageModelTool<ITaskIdParams> {
    /** The underlying service used to manage task state. */
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
            invocationMessage: `Promoting task '${taskId}' to a project`,
            confirmationMessages: {
                title: 'Promote to Project',
                message: new vscode.MarkdownString(
                    `Are you sure you want to promote task \`${taskId}\` to a project? ` +
                    `This will create a project directory and a nested task index, allowing you to create subtasks within it.`
                ),
            },
        };
    }

    /**
     * Invokes the tool: promotes the task to a project.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` confirming the promotion.
     * @throws {Error} If `taskId` is empty, task not found, or task is already a project.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ITaskIdParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskId } = options.input;

        if (!taskId || taskId.trim() === '') {
            throw new Error(
                `A non-empty taskId is required to promote a task. ` +
                `Please provide the ID of the task you wish to convert into a project.`
            );
        }

        try {
            const entry = this.taskManager.promoteTaskToProject(taskId);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Task '${entry.id}' has been successfully promoted to a project. ` +
                    `You can now use 'create_task' with 'parentTaskId: "${entry.id}"' to add subtasks.`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('already a project')) {
                throw new Error(
                    `Task '${taskId}' is already a project and does not need to be promoted.`
                );
            }
            throw mapToolError(err, taskId, 'promote task');
        }
    }
}
