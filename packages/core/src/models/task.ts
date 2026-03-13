/**
 * Represents the lifecycle status of a task.
 *
 * Tasks follow a strict state machine:
 *   `open` → `in-progress` → `closed`
 */
export enum TaskStatus {
    Open = 'open',
    InProgress = 'in-progress',
    Closed = 'closed',
}

/**
 * Types of events emitted by the TaskManager.
 */
export enum TaskEventType {
    Created = 'created',
    Updated = 'updated',
    StatusChanged = 'statusChanged',
    Activated = 'activated',
    Deactivated = 'deactivated',
}

/**
 * Represents a single task entry as stored in `.tasks/index.json`.
 */
export interface TaskEntry {
    /** Unique, URL-friendly identifier for the task (e.g. `'feature-login'`). */
    id: string;

    /** Current lifecycle status of the task. */
    status: TaskStatus;

    /** Unix timestamp (ms) when the task was created. */
    createdAt: number;

    /** Unix timestamp (ms) when the task was last updated. */
    updatedAt: number;

    /** Entry type: 'task' or 'project'. Defaults to 'task'. */
    type: 'task' | 'project';

    /** Optional parent task ID for hierarchical structures. */
    parentTaskId?: string;
}

/**
 * The root structure of the `.tasks/index.json` file.
 */
export interface TaskIndex {
    /** The `id` of the currently active task, or `null` when none is active. */
    activeTaskId: string | null;

    /** Ordered list of all task entries in the workspace. */
    tasks: TaskEntry[];
}
