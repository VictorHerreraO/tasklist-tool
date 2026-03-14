import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { TaskEntry, TaskEventType, TaskIndex, TaskStatus } from '../models/task.js';

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
    /** Emitter for task lifecycle events. */
    private readonly emitter = new EventEmitter();

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.indexPath = path.join(workspaceRoot, INDEX_REL_PATH);
    }

    /**
     * Registers a listener for task update events.
     * 
     * @param listener - Function to call when a task is updated.
     * @returns A function to unregister the listener.
     */
    public onDidUpdateTask(listener: (data: { taskId: string; event: TaskEventType }) => void): () => void {
        this.emitter.on('didUpdateTask', listener);
        return () => {
            this.emitter.off('didUpdateTask', listener);
        };
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

    public findEntryGlobally(id: string, parentTaskId?: string): { entry: TaskEntry; index: TaskIndex; parentTaskId?: string } | undefined {
        if (parentTaskId) {
            const nestedIndex = this.readIndex(parentTaskId);
            const nestedEntry = this.findEntry(nestedIndex, id);
            if (nestedEntry) {
                return { entry: nestedEntry, index: nestedIndex, parentTaskId };
            }
            return undefined;
        }

        const rootIndex = this.readIndex();
        const rootEntry = this.findEntry(rootIndex, id);
        if (rootEntry) {
            return { entry: rootEntry, index: rootIndex };
        }
        return undefined;
    }

    /**
     * Recursively searches for an entry in all project indices.
     * Used internally for parent validation where the exact parent location might not be known.
     */
    private findEntryRecursive(id: string, currentParentId?: string): { entry: TaskEntry; index: TaskIndex; parentTaskId?: string } | undefined {
        const index = this.readIndex(currentParentId);
        const entry = this.findEntry(index, id);
        if (entry) {
            return { entry, index, parentTaskId: currentParentId };
        }

        for (const task of index.tasks) {
            if (task.type === 'project') {
                const found = this.findEntryRecursive(id, task.id);
                if (found) return found;
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
            // Verify parent task exists and is of type 'project'
            // We search recursively because the creator might not know the grandparent
            const result = this.findEntryRecursive(parentTaskId);
            const parentEntry = result?.entry;
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
            this.emitter.emit('didUpdateTask', { taskId: id, event: TaskEventType.Created });
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
            this.emitter.emit('didUpdateTask', { taskId: id, event: TaskEventType.Created });
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
     * Checks if a task with the given `id` exists in the specified parent project or root.
     * 
     * @param id - The ID of the task to check.
     * @param parentTaskId - Optional ID of the parent project.
     */
    taskExists(id: string, parentTaskId?: string): boolean {
        return this.findEntryGlobally(id, parentTaskId) !== undefined;
    }

    /**
     * Transitions a task into a project.
     *
     * @param taskId - ID of the task to promote.
     * @throws {Error} If the task is not found or is already a project.
     */
    promoteTaskToProject(taskId: string): TaskEntry {
        const result = this.findEntryRecursive(taskId);
        if (!result) {
            throw new Error(`Task '${taskId}' not found.`);
        }
        const { entry, index, parentTaskId } = result;
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

        this.writeIndex(index, parentTaskId);
        this.emitter.emit('didUpdateTask', { taskId: taskId, event: TaskEventType.Updated });
        return entry;
    }

    getActiveTask(): TaskEntry | null {
        let currentParentId: string | undefined = undefined;
        let currentActiveId = this.readIndex().activeTaskId;

        if (!currentActiveId) return null;

        let lastFoundEntry: TaskEntry | undefined = undefined;

        while (currentActiveId) {
            const result = this.findEntryGlobally(currentActiveId, currentParentId);
            if (!result) break;

            lastFoundEntry = result.entry;
            if (lastFoundEntry.type === 'project') {
                const projectIndex = this.readIndex(lastFoundEntry.id);
                if (projectIndex.activeTaskId) {
                    currentParentId = lastFoundEntry.id;
                    currentActiveId = projectIndex.activeTaskId;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        return lastFoundEntry ?? null;
    }

    /**
     * Sets `id` as the active task.
     *
     * @param id - ID of the task to activate.
     * @param parentTaskId - Optional ID of the parent project.
     * @param activateProject - Whether to also activate the parent project in the root index.
     * @throws {Error} If no task with `id` exists.
     */
    activateTask(id: string, parentTaskId?: string, activateProject: boolean = true): void {
        const result = this.findEntryGlobally(id, parentTaskId);
        if (!result) {
            throw new Error(`Cannot activate task '${id}': task not found${parentTaskId ? ` in project '${parentTaskId}'` : ''}.`);
        }

        // 1. Update the index where the task is located
        const targetIndex = result.index;
        targetIndex.activeTaskId = id;
        this.writeIndex(targetIndex, result.parentTaskId);

        // 2. Conditionally activate the parent project in the root index
        if (result.parentTaskId && activateProject) {
            const rootIndex = this.readIndex();
            if (this.findEntry(rootIndex, result.parentTaskId)) {
                rootIndex.activeTaskId = result.parentTaskId;
                this.writeIndex(rootIndex);
            }
        }

        this.emitter.emit('didUpdateTask', { taskId: id, event: TaskEventType.Activated });
    }

    /**
     * Clears the active task (sets `activeTaskId` to `null`).
     */
    deactivateTask(): void {
        const rootIndex = this.readIndex();
        rootIndex.activeTaskId = null;
        this.writeIndex(rootIndex);
        this.emitter.emit('didUpdateTask', { taskId: 'none', event: TaskEventType.Deactivated });
    }

    /**
     * Transitions a task from `open` → `in-progress`.
     *
     * @param id - ID of the task to start.
     * @param parentTaskId - Optional ID of the parent project.
     * @throws {Error} If the task is not found or not in `open` status.
     */
    start_task(id: string, parentTaskId?: string): TaskEntry {
        const result = this.findEntryGlobally(id, parentTaskId);
        if (!result) {
            throw new Error(`Task '${id}' not found${parentTaskId ? ` in project '${parentTaskId}'` : ''}.`);
        }
        const { entry, index, parentTaskId: resolvedParentId } = result;
        if (entry.status !== TaskStatus.Open) {
            throw new Error(
                `Cannot start task '${id}': current status is '${entry.status}', expected 'open'.`
            );
        }
        entry.status = TaskStatus.InProgress;
        entry.updatedAt = Date.now();
        this.writeIndex(index, resolvedParentId);
        this.emitter.emit('didUpdateTask', { taskId: id, event: TaskEventType.StatusChanged });
        return entry;
    }

    /**
     * Transitions a task from `in-progress` → `closed`.
     *
     * @param id - ID of the task to close.
     * @param parentTaskId - Optional ID of the parent project.
     * @throws {Error} If the task is not found or not in `in-progress` status.
     */
    close_task(id: string, parentTaskId?: string): TaskEntry {
        const result = this.findEntryGlobally(id, parentTaskId);
        if (!result) {
            throw new Error(`Task '${id}' not found${parentTaskId ? ` in project '${parentTaskId}'` : ''}.`);
        }
        const { entry, index, parentTaskId: resolvedParentId } = result;
        if (entry.status !== TaskStatus.InProgress) {
            throw new Error(
                `Cannot close task '${id}': current status is '${entry.status}', expected 'in-progress'. Use 'start_task' first.`
            );
        }
        entry.status = TaskStatus.Closed;
        entry.updatedAt = Date.now();
        this.writeIndex(index, resolvedParentId);
        this.emitter.emit('didUpdateTask', { taskId: id, event: TaskEventType.StatusChanged });
        return entry;
    }
}
