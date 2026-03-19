import { TaskManager } from '@tasklist/core';

/**
 * Resolves the effective task context from explicit input or the active task.
 *
 * @param taskManager - The `TaskManager` instance to use for resolution.
 * @param taskId - The optional task ID from the tool input.
 * @param parentTaskId - The optional parent task ID from the tool input.
 * @returns The resolved task ID and optional parentTaskId.
 * @throws {Error} If no taskId is supplied and no task is currently active.
 */
export function resolveTaskContext(
    taskManager: TaskManager,
    taskId?: string,
    parentTaskId?: string
): { taskId: string; parentTaskId?: string } {
    if (taskId) {
        return { taskId, parentTaskId };
    }
    const active = taskManager.getActiveTask();
    if (!active) {
        throw new Error(
            'No taskId was provided and there is no currently active task. ' +
            'Pass an explicit taskId or activate a task first using `activate_task`.'
        );
    }
    return { taskId: active.id, parentTaskId: active.parentTaskId };
}

/**
 * Standardized error mapping for task-related tool operations.
 *
 * @param err - The raw error caught from a service call.
 * @param taskId - The task ID involved in the operation.
 * @param context - Optional description of the operation for the error message (e.g., 'list artifacts').
 * @returns A user-friendly Error object for the LLM.
 */
export function mapToolError(err: unknown, taskId: string, context: string): Error {
    const message = err instanceof Error ? err.message : String(err);
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('not found')) {
        return new Error(
            `Task '${taskId}' not found. ` +
            `AI Agent might have forgot to provide a parent project id. ` +
            `Use 'list_tasks' to see available tasks, then retry with a valid taskId and parentTaskId if applicable.`
        );
    }

    return new Error(
        `Failed to ${context} for task '${taskId}': ${message}. ` +
        `Ensure the workspace is accessible and the task exists.`
    );
}
