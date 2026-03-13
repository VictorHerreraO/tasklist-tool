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
     * Returns the absolute path to the index file for the given parent task.
     * If no parentTaskId is provided, returns the root index path.
     */
    private getIndexPath(parentTaskId?: string): string {
        if (!parentTaskId) {
            return this.indexPath;
        }
        return path.join(this.workspaceRoot, '.tasks', parentTaskId, 'index.json');
    }

    /**
     * Reads and parses the index file. Returns a blank index if it does not
     * exist yet (i.e. before the first write).
     * 
     * @param parentTaskId - Optional ID of the parent project.
     */
    private readIndex(parentTaskId?: string): TaskIndex {
        const indexPath = this.getIndexPath(parentTaskId);
        if (!fs.existsSync(indexPath)) {
            return { activeTaskId: null, tasks: [] };
        }
        const raw = fs.readFileSync(indexPath, 'utf-8');
        const index = JSON.parse(raw) as TaskIndex;

        // Migration: Ensure all tasks have a type (default to 'task' for existing data)
        index.tasks = index.tasks.map(t => ({
            ...t,
            type: t.type ?? 'task',
        }));

        return index;
    }

    /**
     * Serialises and writes the index to disk, creating directories lazily.
     * 
     * @param index - The TaskIndex to write.
     * @param parentTaskId - Optional ID of the parent project.
     */
    private writeIndex(index: TaskIndex, parentTaskId?: string): void {
        const indexPath = this.getIndexPath(parentTaskId);
        const dir = path.dirname(indexPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    }

    /** Returns the entry for `id` within a specific `index`, or `undefined` if not found. */
    private findEntry(index: TaskIndex, id: string): TaskEntry | undefined {
        return index.tasks.find(t => t.id === id);
    }

    /**
     * Finds a task entry searching through the root index and then all sub-project indices.
     * 
     * @returns The entry and its containing index/parent ID, or undefined if not found.
     */
    public findEntryGlobally(id: string): { entry: TaskEntry; index: TaskIndex; parentTaskId?: string } | undefined {
        // 1. Check root
        const rootIndex = this.readIndex();
        const rootEntry = this.findEntry(rootIndex, id);
        if (rootEntry) {
            return { entry: rootEntry, index: rootIndex };
        }

        // 2. Check all project sub-indices
        const projects = rootIndex.tasks.filter(t => t.type === 'project');
        for (const project of projects) {
            const nestedIndex = this.readIndex(project.id);
            const nestedEntry = this.findEntry(nestedIndex, id);
            if (nestedEntry) {
                return { entry: nestedEntry, index: nestedIndex, parentTaskId: project.id };
            }
        }
        return undefined;
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Creates a new task with status `open`.
     *
     * @param id - Unique, URL-friendly task identifier.
     * @param type - Whether this is a 'task' or a 'project'.
     * @param parentTaskId - Optional ID of the parent task.
     * @throws {Error} If a task with `id` already exists or parent is invalid.
     */
    createTask(id: string, type: 'task' | 'project' = 'task', parentTaskId?: string): TaskEntry {
        if (parentTaskId) {
            // Verify parent task exists in the root index and is of type 'project'
            const rootIndex = this.readIndex();
            const parentEntry = this.findEntry(rootIndex, parentTaskId);
            if (!parentEntry) {
                throw new Error(`Parent task '${parentTaskId}' not found.`);
            }
            if (parentEntry.type !== 'project') {
                throw new Error(`Parent task '${parentTaskId}' is not a project.`);
            }

            // Save in the nested index
            const nestedIndex = this.readIndex(parentTaskId);
            if (this.findEntry(nestedIndex, id)) {
                throw new Error(`Task '${id}' already exists in project '${parentTaskId}'.`);
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
            nestedIndex.tasks.push(entry);
            this.writeIndex(nestedIndex, parentTaskId);
            return entry;
        } else {
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
            };
            index.tasks.push(entry);
            this.writeIndex(index);
            return entry;
        }
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
        const index = this.readIndex(parentTaskIdFilter);
        return index.tasks.filter(t => {
            const matchesStatus = statusFilter === undefined || t.status === statusFilter;
            const matchesParent = parentTaskIdFilter === undefined
                ? !t.parentTaskId  // Default: only top-level
                : true;           // All in nested index are subtasks
            return matchesStatus && matchesParent;
        });
    }

    /**
     * Checks if a task with the given `id` exists anywhere in the workspace.
     * 
     * @param id - The ID of the task to check.
     */
    taskExists(id: string): boolean {
        return this.findEntryGlobally(id) !== undefined;
    }

    /**
     * Transitions a task into a project.
     *
     * @param taskId - ID of the task to promote.
     * @throws {Error} If the task is not found or is already a project.
     */
    promoteTaskToProject(taskId: string): TaskEntry {
        const index = this.readIndex();
        const entry = this.findEntry(index, taskId);
        if (!entry) {
            throw new Error(`Task '${taskId}' not found.`);
        }
        if (entry.type === 'project') {
            throw new Error(`Task '${taskId}' is already a project.`);
        }

        // Change type to project
        entry.type = 'project';
        entry.updatedAt = Date.now();

        // Ensure project directory exists at .tasks/${taskId}/
        const projectDir = path.join(this.workspaceRoot, '.tasks', taskId);
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }

        // Initialize empty sub-index if it doesn't exist
        const subIndexPath = this.getIndexPath(taskId);
        if (!fs.existsSync(subIndexPath)) {
            const subIndex: TaskIndex = { activeTaskId: null, tasks: [] };
            this.writeIndex(subIndex, taskId);
        }

        this.writeIndex(index);
        return entry;
    }

    /**
     * Returns the currently active task entry, or `null` if none is active.
     */
    getActiveTask(): TaskEntry | null {
        const rootIndex = this.readIndex();
        if (!rootIndex.activeTaskId) {
            return null;
        }
        const result = this.findEntryGlobally(rootIndex.activeTaskId);
        return result?.entry ?? null;
    }

    /**
     * Sets `id` as the active task.
     *
     * @param id - ID of the task to activate.
     * @throws {Error} If no task with `id` exists.
     */
    activateTask(id: string): void {
        const result = this.findEntryGlobally(id);
        if (!result) {
            throw new Error(`Cannot activate task '${id}': task not found.`);
        }
        const rootIndex = this.readIndex();
        rootIndex.activeTaskId = id;
        this.writeIndex(rootIndex);
    }

    /**
     * Clears the active task (sets `activeTaskId` to `null`).
     */
    deactivateTask(): void {
        const rootIndex = this.readIndex();
        rootIndex.activeTaskId = null;
        this.writeIndex(rootIndex);
    }

    /**
     * Transitions a task from `open` → `in-progress`.
     *
     * @param id - ID of the task to start.
     * @throws {Error} If the task is not found or not in `open` status.
     */
    start_task(id: string): TaskEntry {
        const result = this.findEntryGlobally(id);
        if (!result) {
            throw new Error(`Task '${id}' not found.`);
        }
        const { entry, index, parentTaskId } = result;
        if (entry.status !== TaskStatus.Open) {
            throw new Error(
                `Cannot start task '${id}': current status is '${entry.status}', expected 'open'.`
            );
        }
        entry.status = TaskStatus.InProgress;
        entry.updatedAt = Date.now();
        this.writeIndex(index, parentTaskId);
        return entry;
    }

    /**
     * Transitions a task from `in-progress` → `closed`.
     *
     * @param id - ID of the task to close.
     * @throws {Error} If the task is not found or not in `in-progress` status.
     */
    close_task(id: string): TaskEntry {
        const result = this.findEntryGlobally(id);
        if (!result) {
            throw new Error(`Task '${id}' not found.`);
        }
        const { entry, index, parentTaskId } = result;
        if (entry.status !== TaskStatus.InProgress) {
            throw new Error(
                `Cannot close task '${id}': current status is '${entry.status}', expected 'in-progress'. Use 'start_task' first.`
            );
        }
        entry.status = TaskStatus.Closed;
        entry.updatedAt = Date.now();
        this.writeIndex(index, parentTaskId);
        return entry;
    }
}
