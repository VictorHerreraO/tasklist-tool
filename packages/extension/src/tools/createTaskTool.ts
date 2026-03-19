import * as vscode from 'vscode';
import { TaskManager } from '@tasklist/core';
import { ICreateTaskParams } from './interfaces.js';
import { mapToolError } from './toolUtils.js';

/**
 * Language model tool that creates a new task in the current workspace.
 *
 * The task is initialised with status `'open'` and a unique, URL-friendly ID
 * supplied by the agent. The ID must not already exist in the workspace.
 *
 * Implements `vscode.LanguageModelTool<ICreateTaskParams>`.
 */
export class CreateTaskTool implements vscode.LanguageModelTool<ICreateTaskParams> {
    /** The underlying service used to persist the new task to disk. */
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
        options: vscode.LanguageModelToolInvocationPrepareOptions<ICreateTaskParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { taskId, type, parentTaskId } = options.input;
        const typeLabel = type === 'project' ? 'project' : 'task';
        const parentLabel = parentTaskId ? ` as a subtask of project \`${parentTaskId}\`` : '';

        return {
            invocationMessage: `Creating ${typeLabel} '${taskId}'${parentLabel}`,
            confirmationMessages: {
                title: 'Create Task',
                message: new vscode.MarkdownString(
                    `Create a new ${typeLabel} with ID \`${taskId}\` and status \`open\`${parentLabel} in the workspace index.`
                ),
            },
        };
    }

    /**
     * Invokes the tool: creates a new task entry on disk.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` confirming the created task.
     * @throws {Error} If `taskId` is empty or already exists.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ICreateTaskParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskId, type, parentTaskId } = options.input;

        if (!taskId || taskId.trim() === '') {
            throw new Error(
                `A non-empty taskId is required to create a task. ` +
                `Please provide a unique, URL-friendly identifier (e.g. 'feature-login').`
            );
        }

        try {
            const entry = this.taskManager.createTask(taskId, type || 'task', parentTaskId);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `${entry.type === 'project' ? 'Project' : 'Task'} '${entry.id}' created successfully with status '${entry.status}'${parentTaskId ? ` under parent '${parentTaskId}'` : ''}.`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('already exists')) {
                throw new Error(
                    `Cannot create task: ${message} ` +
                    `Choose a different taskId or use 'list_tasks' to review existing tasks.`
                );
            }
            if (message.includes('is not a project')) {
                throw new Error(
                    `Cannot create subtask: ${message} ` +
                    `Please ensure you provide the correct ID of an existing project. Use 'list_tasks' to see available projects.`
                );
            }
            throw mapToolError(err, parentTaskId || taskId, 'create task');
        }
    }
}
