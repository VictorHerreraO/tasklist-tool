/**
 * MCP tool handler functions for task lifecycle management.
 *
 * This module exports pure, testable handler functions for each task tool.
 * Each handler accepts only what it needs via parameters rather than closing
 * over module-level singletons — making them easy to unit-test with isolated
 * TaskManager instances.
 *
 * The server registrations in `tasks.ts` import and delegate to these handlers.
 */

import { TaskManager, TaskStatus } from '@tasklist/core';

// ─── Shared response types ────────────────────────────────────────────────────

// Index signature required for compatibility with the MCP SDK's Result type.
export interface McpToolResult {
    [key: string]: unknown;
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function errorResult(message: string): McpToolResult {
    return { content: [{ type: 'text', text: message }], isError: true };
}

function successResult(message: string): McpToolResult {
    return { content: [{ type: 'text', text: message }] };
}

// ─── list_tasks ──────────────────────────────────────────────────────────────

export async function handleListTasks(
    manager: TaskManager,
    input: { status?: string; parentTaskId?: string }
): Promise<McpToolResult> {
    let statusFilter: TaskStatus | undefined;

    if (input.status !== undefined) {
        const validStatuses = Object.values(TaskStatus) as string[];
        if (!validStatuses.includes(input.status)) {
            return errorResult(
                `Invalid status filter '${input.status}'. ` +
                `Accepted values are: ${validStatuses.map(s => `'${s}'`).join(', ')}. ` +
                `Please retry with one of those values, or omit the filter to list all tasks.`
            );
        }
        statusFilter = input.status as TaskStatus;
    }

    try {
        const tasks = manager.listTasks(statusFilter, input.parentTaskId);

        if (tasks.length === 0) {
            let context = statusFilter ? ` with status '${statusFilter}'` : '';
            if (input.parentTaskId) {
                context += ` in project '${input.parentTaskId}'`;
            }
            return successResult(`No tasks found${context} in the workspace.`);
        }

        const lines = tasks.map(
            t => `- ${t.id} [${t.status}]${t.type === 'project' ? ' (project)' : ''} (created: ${new Date(t.createdAt).toISOString()}, updated: ${new Date(t.updatedAt).toISOString()})`
        );
        return successResult(`Found ${tasks.length} task(s):\n${lines.join('\n')}`);
    } catch (err: unknown) {
        return errorResult(
            `Failed to list tasks: ${toErrorMessage(err)}. ` +
            `Check that the workspace root is accessible and the task index is valid.`
        );
    }
}

// ─── create_task ─────────────────────────────────────────────────────────────

export async function handleCreateTask(
    manager: TaskManager,
    input: { taskId: string; type?: 'task' | 'project'; parentTaskId?: string }
): Promise<McpToolResult> {
    const { taskId, type, parentTaskId } = input;

    if (!taskId || taskId.trim() === '') {
        return errorResult(
            'A non-empty taskId is required to create a task. ' +
            'Please provide a unique, URL-friendly identifier (e.g. "feature-login").'
        );
    }

    try {
        const entry = manager.createTask(taskId, type, parentTaskId);
        const typeStr = entry.type === 'project' ? 'project' : 'task';
        const parentStr = entry.parentTaskId ? ` in project '${entry.parentTaskId}'` : '';
        return successResult(
            `Task '${entry.id}' (${typeStr}) created successfully${parentStr} with status '${entry.status}'.`
        );
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        if (message.includes('already exists')) {
            return errorResult(
                `Cannot create task: ${message} ` +
                `Choose a different taskId or use 'list_tasks' to review existing tasks.`
            );
        }
        return errorResult(
            `Failed to create task '${taskId}': ${message}. ` +
            `Ensure the workspace root is writable and the taskId is a valid identifier.`
        );
    }
}

// ─── activate_task ───────────────────────────────────────────────────────────

export async function handleActivateTask(
    manager: TaskManager,
    input: { taskId: string }
): Promise<McpToolResult> {
    const { taskId } = input;
    try {
        manager.activateTask(taskId);
        return successResult(`Task '${taskId}' is now the active task.`);
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        if (message.includes('task not found')) {
            return errorResult(
                `Cannot activate task '${taskId}': task not found. ` +
                `Use 'list_tasks' to see available task IDs, then retry with a valid taskId.`
            );
        }
        return errorResult(
            `Failed to activate task '${taskId}': ${message}. ` +
            `Verify the taskId is correct and the workspace index is accessible.`
        );
    }
}

// ─── deactivate_task ─────────────────────────────────────────────────────────

export async function handleDeactivateTask(
    manager: TaskManager
): Promise<McpToolResult> {
    try {
        manager.deactivateTask();
        return successResult('The active task has been cleared. No task is currently active.');
    } catch (err: unknown) {
        return errorResult(
            `Failed to deactivate task: ${toErrorMessage(err)}. ` +
            `Ensure the workspace index is accessible and try again.`
        );
    }
}

// ─── start_task ──────────────────────────────────────────────────────────────

export async function handleStartTask(
    manager: TaskManager,
    input: { taskId: string }
): Promise<McpToolResult> {
    const { taskId } = input;
    try {
        const entry = manager.start_task(taskId);
        return successResult(
            `Task '${entry.id}' has been started. Status is now '${entry.status}'.`
        );
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        if (message.includes('not found')) {
            return errorResult(
                `Cannot start task '${taskId}': task not found. ` +
                `Use 'list_tasks' to see available tasks, then retry with a valid taskId.`
            );
        }
        if (message.includes("expected 'open'")) {
            return errorResult(
                `Cannot start task '${taskId}': ${message} ` +
                `Only tasks in 'open' status can be started. ` +
                `Use 'list_tasks' to inspect the task's current status.`
            );
        }
        return errorResult(
            `Failed to start task '${taskId}': ${message}. ` +
            `Verify the taskId is correct and the workspace index is accessible.`
        );
    }
}

// ─── close_task ──────────────────────────────────────────────────────────────

export async function handleCloseTask(
    manager: TaskManager,
    input: { taskId: string }
): Promise<McpToolResult> {
    const { taskId } = input;
    try {
        const entry = manager.close_task(taskId);
        return successResult(
            `Task '${entry.id}' has been closed. Status is now '${entry.status}'.`
        );
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        if (message.includes('not found')) {
            return errorResult(
                `Cannot close task '${taskId}': task not found. ` +
                `Use 'list_tasks' to see available tasks, then retry with a valid taskId.`
            );
        }
        if (message.includes("expected 'in-progress'")) {
            return errorResult(
                `Cannot close task '${taskId}': ${message} ` +
                `Only tasks in 'in-progress' status can be closed. ` +
                `If the task is 'open', call 'start_task' first.`
            );
        }
        return errorResult(
            `Failed to close task '${taskId}': ${message}. ` +
            `Verify the taskId is correct and the workspace index is accessible.`
        );
    }
}

// ─── promote_to_project ──────────────────────────────────────────────────────

export async function handlePromoteToProject(
    manager: TaskManager,
    input: { taskId: string }
): Promise<McpToolResult> {
    const { taskId } = input;
    try {
        const entry = manager.promoteTaskToProject(taskId);
        return successResult(
            `Task '${entry.id}' has been promoted to a project. It can now contain subtasks.`
        );
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        if (message.includes('not found')) {
            return errorResult(
                `Cannot promote task '${taskId}': task not found. ` +
                `Use 'list_tasks' to see available tasks.`
            );
        }
        return errorResult(
            `Failed to promote task '${taskId}': ${message}.`
        );
    }
}
