/**
 * MCP tool registrations for task lifecycle management.
 *
 * Registers 6 tools against the shared `server` instance:
 *   - list_tasks
 *   - create_task
 *   - activate_task
 *   - deactivate_task
 *   - start_task
 *   - close_task
 *
 * Import this module as a side effect (no named exports used) so that
 * tool registrations run before the server connects to its transport.
 */

import { z } from 'zod';
import { TaskStatus } from '@tasklist/core';
import { server } from '../server.js';
import { taskManager } from '../workspaceRoot.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Converts an unknown caught value to a plain error string. */
function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Standard MCP error response. */
function errorResult(message: string) {
    return {
        content: [{ type: 'text' as const, text: message }],
        isError: true,
    };
}

// ─── Tool: list_tasks ────────────────────────────────────────────────────────

server.tool(
    'list_tasks',
    'List tasks in the workspace, optionally filtered by status. ' +
    'Returns task IDs, statuses, and timestamps. ' +
    'Accepted status values: "open", "in-progress", "closed". Omit to list all tasks.',
    {
        status: z
            .enum([TaskStatus.Open, TaskStatus.InProgress, TaskStatus.Closed])
            .optional()
            .describe('Filter tasks by this status. Omit to return all tasks.'),
    },
    async ({ status }) => {
        // Validate status against enum values.
        let statusFilter: TaskStatus | undefined;
        if (status !== undefined) {
            const validStatuses = Object.values(TaskStatus) as string[];
            if (!validStatuses.includes(status)) {
                return errorResult(
                    `Invalid status filter '${status}'. ` +
                    `Accepted values are: ${validStatuses.map(s => `'${s}'`).join(', ')}. ` +
                    `Please retry with one of those values, or omit the filter to list all tasks.`
                );
            }
            statusFilter = status as TaskStatus;
        }

        try {
            const tasks = taskManager.listTasks(statusFilter);

            if (tasks.length === 0) {
                const context = statusFilter ? ` with status '${statusFilter}'` : '';
                return {
                    content: [{ type: 'text', text: `No tasks found${context} in the workspace.` }],
                };
            }

            const lines = tasks.map(
                t => `- ${t.id} [${t.status}] (created: ${new Date(t.createdAt).toISOString()}, updated: ${new Date(t.updatedAt).toISOString()})`
            );
            return {
                content: [{ type: 'text', text: `Found ${tasks.length} task(s):\n${lines.join('\n')}` }],
            };
        } catch (err: unknown) {
            return errorResult(
                `Failed to list tasks: ${toErrorMessage(err)}. ` +
                `Check that the workspace root is accessible and the task index is valid.`
            );
        }
    }
);

// ─── Tool: create_task ───────────────────────────────────────────────────────

server.tool(
    'create_task',
    'Create a new task in the workspace with status "open". ' +
    'The taskId must be unique and URL-friendly (e.g. "feature-login"). ' +
    'Use list_tasks to check for existing IDs before creating.',
    {
        taskId: z
            .string()
            .min(1, 'taskId must not be empty')
            .describe('Unique, URL-friendly identifier for the new task (e.g. "feature-login").'),
    },
    async ({ taskId }) => {
        if (!taskId || taskId.trim() === '') {
            return errorResult(
                'A non-empty taskId is required to create a task. ' +
                'Please provide a unique, URL-friendly identifier (e.g. "feature-login").'
            );
        }

        try {
            const entry = taskManager.createTask(taskId);
            return {
                content: [{
                    type: 'text',
                    text: `Task '${entry.id}' created successfully with status '${entry.status}'.`,
                }],
            };
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
);

// ─── Tool: activate_task ─────────────────────────────────────────────────────

server.tool(
    'activate_task',
    'Set a task as the currently active task. ' +
    'Only one task can be active at a time; activating a different task replaces the previous active task. ' +
    'The task must exist in the workspace index.',
    {
        taskId: z
            .string()
            .min(1)
            .describe('ID of the task to activate (e.g. "feature-login").'),
    },
    async ({ taskId }) => {
        try {
            taskManager.activateTask(taskId);
            return {
                content: [{ type: 'text', text: `Task '${taskId}' is now the active task.` }],
            };
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
);

// ─── Tool: deactivate_task ───────────────────────────────────────────────────

server.tool(
    'deactivate_task',
    'Clear the currently active task so that no task is active. ' +
    'This operation is idempotent — it succeeds even if no task is currently active.',
    {},
    async () => {
        try {
            taskManager.deactivateTask();
            return {
                content: [{
                    type: 'text',
                    text: 'The active task has been cleared. No task is currently active.',
                }],
            };
        } catch (err: unknown) {
            return errorResult(
                `Failed to deactivate task: ${toErrorMessage(err)}. ` +
                `Ensure the workspace index is accessible and try again.`
            );
        }
    }
);

// ─── Tool: start_task ────────────────────────────────────────────────────────

server.tool(
    'start_task',
    'Transition a task from "open" → "in-progress". ' +
    'Only tasks in "open" status can be started. ' +
    'Attempting to start a task in any other state returns an error with guidance.',
    {
        taskId: z
            .string()
            .min(1)
            .describe('ID of the task to start (must be in "open" status).'),
    },
    async ({ taskId }) => {
        try {
            const entry = taskManager.start_task(taskId);
            return {
                content: [{
                    type: 'text',
                    text: `Task '${entry.id}' has been started. Status is now '${entry.status}'.`,
                }],
            };
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
);

// ─── Tool: close_task ────────────────────────────────────────────────────────

server.tool(
    'close_task',
    'Transition a task from "in-progress" → "closed". ' +
    'The task must currently be "in-progress" (call start_task first if it is "open"). ' +
    'Attempting to close a task in any other state returns an error with guidance.',
    {
        taskId: z
            .string()
            .min(1)
            .describe('ID of the task to close (must be in "in-progress" status).'),
    },
    async ({ taskId }) => {
        try {
            const entry = taskManager.close_task(taskId);
            return {
                content: [{
                    type: 'text',
                    text: `Task '${entry.id}' has been closed. Status is now '${entry.status}'.`,
                }],
            };
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
);
