import * as vscode from 'vscode';
import { TaskManager, TaskStatus } from '@tasklist/core';
import { IListTasksParams } from './interfaces.js';

/**
 * Language model tool that lists tasks in the current workspace.
 *
 * The agent can optionally filter by status (`'open'`, `'in-progress'`,
 * `'closed'`). When no filter is provided all tasks are returned.
 *
 * Implements `vscode.LanguageModelTool<IListTasksParams>`.
 */
export class ListTasksTool implements vscode.LanguageModelTool<IListTasksParams> {
    /** The underlying service used to read tasks from disk. */
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
        options: vscode.LanguageModelToolInvocationPrepareOptions<IListTasksParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const statusFilter = options.input.status;
        const filterLabel = statusFilter ? ` with status \`${statusFilter}\`` : '';
        return {
            invocationMessage: `Listing tasks${filterLabel}`,
            confirmationMessages: {
                title: 'List Tasks',
                message: new vscode.MarkdownString(
                    `Retrieve all tasks${filterLabel} from the workspace index.`
                ),
            },
        };
    }

    /**
     * Invokes the tool: reads tasks from disk and returns them as formatted text.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` with a human-readable task summary.
     * @throws {Error} If the provided status string is not a recognised value.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IListTasksParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { status } = options.input;

        // Validate status filter before forwarding to the service.
        let statusFilter: TaskStatus | undefined;
        if (status !== undefined) {
            const validStatuses: string[] = Object.values(TaskStatus);
            if (!validStatuses.includes(status)) {
                throw new Error(
                    `Invalid status filter '${status}'. ` +
                    `Accepted values are: ${validStatuses.map(s => `'${s}'`).join(', ')}. ` +
                    `Please retry with one of those values, or omit the filter to list all tasks.`
                );
            }
            statusFilter = status as TaskStatus;
        }

        try {
            const tasks = this.taskManager.listTasks(statusFilter);

            if (tasks.length === 0) {
                const context = statusFilter ? ` with status '${statusFilter}'` : '';
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`No tasks found${context} in the workspace.`),
                ]);
            }

            const lines = tasks.map(
                t => `- ${t.id} [${t.status}] (created: ${new Date(t.createdAt).toISOString()}, updated: ${new Date(t.updatedAt).toISOString()})`
            );
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Found ${tasks.length} task(s):\n${lines.join('\n')}`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(
                `Failed to list tasks: ${message}. ` +
                `Check that the workspace root is accessible and the task index is valid.`
            );
        }
    }
}
