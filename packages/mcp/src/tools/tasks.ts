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
 * Handler logic lives in `../handlers/taskHandlers.ts` for testability.
 * Import this module as a side effect so tool registrations run before
 * the server connects to its transport.
 */

import { z } from 'zod';
import { TaskStatus } from '@tasklist/core';
import { server } from '../server.js';
import { taskManager } from '../workspaceRoot.js';
import {
    handleListTasks,
    handleCreateTask,
    handleActivateTask,
    handleDeactivateTask,
    handleStartTask,
    handleCloseTask,
} from '../handlers/taskHandlers.js';

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
    ({ status }) => handleListTasks(taskManager, { status })
);

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
    ({ taskId }) => handleCreateTask(taskManager, { taskId })
);

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
    ({ taskId }) => handleActivateTask(taskManager, { taskId })
);

server.tool(
    'deactivate_task',
    'Clear the currently active task so that no task is active. ' +
    'This operation is idempotent — it succeeds even if no task is currently active.',
    {},
    () => handleDeactivateTask(taskManager)
);

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
    ({ taskId }) => handleStartTask(taskManager, { taskId })
);

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
    ({ taskId }) => handleCloseTask(taskManager, { taskId })
);
