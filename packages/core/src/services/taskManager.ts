import * as fs from 'fs';
import * as path from 'path';
import { TaskEntry, TaskIndex, TaskStatus } from '../models/task.js';

/** Relative path (from workspace root) to the index file. */
const INDEX_REL_PATH = path.join('.tasks', 'index.json');

/**
 * Manages the task lifecycle for a single workspace.
 *
 * All state is persisted to `.tasks/index.json` relative to the workspace root.
 * The `.tasks/` directory and initial `index.json` are created lazily on the
 * first write operation.
 */
export class TaskManager {
    /** Absolute path to the workspace root directory. */
    private readonly workspaceRoot: string;

    /** Absolute path to `.tasks/index.json`. */
    private readonly indexPath: string;

    /**
     * @param workspaceRoot - Absolute path to the VS Code workspace root folder.
     */
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.indexPath = path.join(workspaceRoot, INDEX_REL_PATH);
    }

    // ─── Private Helpers ────────────────────────────────────────────────────

    /**
     * Reads and parses the index file. Returns a blank index if it does not
     * exist yet (i.e. before the first write).
     */
    private readIndex(): TaskIndex {
        if (!fs.existsSync(this.indexPath)) {
            return { activeTaskId: null, tasks: [] };
        }
        const raw = fs.readFileSync(this.indexPath, 'utf-8');
        const index = JSON.parse(raw) as TaskIndex;

        // Migration: Ensure all tasks have a type (default to 'task' for existing data)
        index.tasks = index.tasks.map(t => ({
            ...t,
            type: t.type ?? 'task',
        }));

        return index;
    }

    /**
     * Serialises and writes the index to disk, creating `.tasks/` lazily.
     */
    private writeIndex(index: TaskIndex): void {
        const dir = path.join(this.workspaceRoot, '.tasks');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
    }

    /** Returns the entry for `id`, or `undefined` if not found. */
    private findEntry(index: TaskIndex, id: string): TaskEntry | undefined {
        return index.tasks.find(t => t.id === id);
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Creates a new task with status `open`.
     *
     * @param id - Unique, URL-friendly task identifier.
     * @param type - Whether this is a 'task' or a 'project'.
     * @param parentTaskId - Optional ID of the parent task.
     * @throws {Error} If a task with `id` already exists.
     */
    createTask(id: string, type: 'task' | 'project' = 'task', parentTaskId?: string): TaskEntry {
        const index = this.readIndex();
        if (this.findEntry(index, id)) {
            throw new Error(`Task '${id}' already exists.`);
        }
        const now = Date.now();
        const entry: TaskEntry = {
            id,
            status: TaskStatus.Open,
            createdAt: now,
            updatedAt: now,
            type,
            parentTaskId,
        };
        index.tasks.push(entry);
        this.writeIndex(index);
        return entry;
    }

    /**
     * Returns tasks, optionally filtered by status and parent task ID.
     *
     * By default, only top-level tasks (those without a parent) are returned.
     * To retrieve subtasks for a specific parent, provide its `parentTaskId`.
     *
     * @param statusFilter - When provided, only tasks with this status are returned.
     * @param parentTaskIdFilter - When provided, only tasks with this parent are returned.
     *                             If omitted, only top-level tasks are returned.
     */
    listTasks(statusFilter?: TaskStatus, parentTaskIdFilter?: string): TaskEntry[] {
        const index = this.readIndex();
        return index.tasks.filter(t => {
            const matchesStatus = statusFilter === undefined || t.status === statusFilter;
            const matchesParent = parentTaskIdFilter === undefined
                ? !t.parentTaskId  // Default: only top-level
                : t.parentTaskId === parentTaskIdFilter;
            return matchesStatus && matchesParent;
        });
    }

    /**
     * Returns the currently active task entry, or `null` if none is active.
     */
    getActiveTask(): TaskEntry | null {
        const index = this.readIndex();
        if (!index.activeTaskId) {
            return null;
        }
        return this.findEntry(index, index.activeTaskId) ?? null;
    }

    /**
     * Sets `id` as the active task.
     *
     * @param id - ID of the task to activate.
     * @throws {Error} If no task with `id` exists.
     */
    activateTask(id: string): void {
        const index = this.readIndex();
        if (!this.findEntry(index, id)) {
            throw new Error(`Cannot activate task '${id}': task not found.`);
        }
        index.activeTaskId = id;
        this.writeIndex(index);
    }

    /**
     * Clears the active task (sets `activeTaskId` to `null`).
     */
    deactivateTask(): void {
        const index = this.readIndex();
        index.activeTaskId = null;
        this.writeIndex(index);
    }

    /**
     * Transitions a task from `open` → `in-progress`.
     *
     * @param id - ID of the task to start.
     * @throws {Error} If the task is not found or not in `open` status.
     */
    start_task(id: string): TaskEntry {
        const index = this.readIndex();
        const entry = this.findEntry(index, id);
        if (!entry) {
            throw new Error(`Task '${id}' not found.`);
        }
        if (entry.status !== TaskStatus.Open) {
            throw new Error(
                `Cannot start task '${id}': current status is '${entry.status}', expected 'open'.`
            );
        }
        entry.status = TaskStatus.InProgress;
        entry.updatedAt = Date.now();
        this.writeIndex(index);
        return entry;
    }

    /**
     * Transitions a task from `in-progress` → `closed`.
     *
     * @param id - ID of the task to close.
     * @throws {Error} If the task is not found or not in `in-progress` status.
     */
    close_task(id: string): TaskEntry {
        const index = this.readIndex();
        const entry = this.findEntry(index, id);
        if (!entry) {
            throw new Error(`Task '${id}' not found.`);
        }
        if (entry.status !== TaskStatus.InProgress) {
            throw new Error(
                `Cannot close task '${id}': current status is '${entry.status}', expected 'in-progress'. Use 'start_task' first.`
            );
        }
        entry.status = TaskStatus.Closed;
        entry.updatedAt = Date.now();
        this.writeIndex(index);
        return entry;
    }
}
