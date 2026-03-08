/**
 * Input parameter interfaces for the task management LM tools.
 *
 * These interfaces mirror the JSON schemas declared in `package.json`
 * under `contributes.languageModelTools[*].inputSchema` and are used
 * as generics for `vscode.LanguageModelTool<T>`.
 */

/**
 * Parameters for the `list_tasks` tool.
 */
export interface IListTasksParams {
    /**
     * Optional status filter. When provided, only tasks with this status are
     * returned. Accepted values: `'open'`, `'in-progress'`, `'closed'`.
     * Omit to list all tasks.
     */
    status?: string;
}

/**
 * Parameters for the `create_task` tool.
 */
export interface ICreateTaskParams {
    /**
     * Unique, URL-friendly identifier for the new task
     * (e.g. `'feature-login'`). Must not already exist in the workspace.
     */
    taskId: string;
}

/**
 * Generic parameters for tools that operate on a single task by its ID.
 *
 * Reused for: `activate_task`, `deactivate_task`, `start_task`, `close_task`.
 * (`deactivate_task` does not actually need a taskId but we keep the shape
 * consistent so the LM can still pass it without causing an error.)
 */
export interface ITaskIdParams {
    /**
     * The unique identifier of the task to operate on
     * (e.g. `'feature-login'`).
     */
    taskId: string;
}
