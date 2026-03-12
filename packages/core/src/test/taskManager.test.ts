import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager } from '../services/taskManager.js';
import { TaskStatus } from '../models/task.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Creates an isolated temp directory for a test workspace. */
function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-test-'));
}

/** Removes the temp directory and all its contents. */
function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('TaskManager', () => {
    let workspaceRoot: string;
    let manager: TaskManager;

    beforeEach(() => {
        workspaceRoot = makeTmpWorkspace();
        manager = new TaskManager(workspaceRoot);
    });

    afterEach(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    // ── Lazy initialisation ────────────────────────────────────────────────

    describe('lazy initialisation', () => {
        it('does NOT create .tasks/ on construction', () => {
            const tasksDir = path.join(workspaceRoot, '.tasks');
            assert.strictEqual(fs.existsSync(tasksDir), false, '.tasks/ should not exist yet');
        });

        it('creates .tasks/ and index.json on first write (createTask)', () => {
            manager.createTask('first-task');
            const indexPath = path.join(workspaceRoot, '.tasks', 'index.json');
            assert.ok(fs.existsSync(indexPath), 'index.json should be created after first write');
        });

        it('index.json contains valid JSON after first write', () => {
            manager.createTask('first-task');
            const indexPath = path.join(workspaceRoot, '.tasks', 'index.json');
            const raw = fs.readFileSync(indexPath, 'utf-8');
            assert.doesNotThrow(() => JSON.parse(raw), 'index.json should be valid JSON');
        });

        it('listTasks returns empty array before any writes', () => {
            const tasks = manager.listTasks();
            assert.deepStrictEqual(tasks, []);
        });

        it('getActiveTask returns null before any writes', () => {
            assert.strictEqual(manager.getActiveTask(), null);
        });
    });

    // ── CRUD operations ────────────────────────────────────────────────────

    describe('createTask', () => {
        it('returns a TaskEntry with correct id and open status', () => {
            const entry = manager.createTask('my-task');
            assert.strictEqual(entry.id, 'my-task');
            assert.strictEqual(entry.status, TaskStatus.Open);
        });

        it('sets createdAt and updatedAt to approximately now', () => {
            const before = Date.now();
            const entry = manager.createTask('my-task');
            const after = Date.now();
            assert.ok(entry.createdAt >= before && entry.createdAt <= after);
            assert.ok(entry.updatedAt >= before && entry.updatedAt <= after);
        });

        it('persists task across manager instances (reads from disk)', () => {
            manager.createTask('persisted-task');
            const manager2 = new TaskManager(workspaceRoot);
            const tasks = manager2.listTasks();
            assert.strictEqual(tasks.length, 1);
            assert.strictEqual(tasks[0].id, 'persisted-task');
        });

        it('throws when id already exists', () => {
            manager.createTask('dup-task');
            assert.throws(
                () => manager.createTask('dup-task'),
                /Task 'dup-task' already exists\./
            );
        });
    });

    describe('listTasks', () => {
        beforeEach(() => {
            manager.createTask('task-a'); // open
            manager.createTask('task-b'); // will become in-progress
            manager.createTask('task-c'); // will become closed
            manager.start_task('task-b');
            manager.start_task('task-c');
            manager.close_task('task-c');
        });

        it('returns all tasks when no filter is given', () => {
            assert.strictEqual(manager.listTasks().length, 3);
        });

        it('filters by open status', () => {
            const result = manager.listTasks(TaskStatus.Open);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'task-a');
        });

        it('filters by in-progress status', () => {
            const result = manager.listTasks(TaskStatus.InProgress);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'task-b');
        });

        it('filters by closed status', () => {
            const result = manager.listTasks(TaskStatus.Closed);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'task-c');
        });

        it('returns empty array for filter with no matches', () => {
            // All tasks created fresh in a new workspace
            const emptyManager = new TaskManager(makeTmpWorkspace());
            const result = emptyManager.listTasks(TaskStatus.Closed);
            assert.deepStrictEqual(result, []);
        });
    });

    // ── Activation / Deactivation ──────────────────────────────────────────

    describe('activateTask / deactivateTask / getActiveTask', () => {
        it('activates a task and getActiveTask returns it', () => {
            manager.createTask('task-x');
            manager.activateTask('task-x');
            const active = manager.getActiveTask();
            assert.ok(active);
            assert.strictEqual(active.id, 'task-x');
        });

        it('only one task can be active at a time', () => {
            manager.createTask('task-1');
            manager.createTask('task-2');
            manager.activateTask('task-1');
            manager.activateTask('task-2');
            assert.strictEqual(manager.getActiveTask()?.id, 'task-2');
        });

        it('deactivateTask clears the active task', () => {
            manager.createTask('task-x');
            manager.activateTask('task-x');
            manager.deactivateTask();
            assert.strictEqual(manager.getActiveTask(), null);
        });

        it('deactivateTask is idempotent when no task is active', () => {
            assert.doesNotThrow(() => manager.deactivateTask());
        });

        it('activateTask throws for non-existent task', () => {
            assert.throws(
                () => manager.activateTask('no-such-task'),
                /Cannot activate task 'no-such-task': task not found\./
            );
        });
    });

    // ── State machine: valid transitions ───────────────────────────────────

    describe('start_task (open → in-progress)', () => {
        it('transitions status to in-progress', () => {
            manager.createTask('t1');
            const entry = manager.start_task('t1');
            assert.strictEqual(entry.status, TaskStatus.InProgress);
        });

        it('updates updatedAt timestamp', () => {
            manager.createTask('t1');
            const before = Date.now();
            const entry = manager.start_task('t1');
            assert.ok(entry.updatedAt >= before);
        });

        it('persists status change to disk', () => {
            manager.createTask('t1');
            manager.start_task('t1');
            const manager2 = new TaskManager(workspaceRoot);
            assert.strictEqual(manager2.listTasks()[0].status, TaskStatus.InProgress);
        });
    });

    describe('close_task (in-progress → closed)', () => {
        it('transitions status to closed', () => {
            manager.createTask('t2');
            manager.start_task('t2');
            const entry = manager.close_task('t2');
            assert.strictEqual(entry.status, TaskStatus.Closed);
        });

        it('updates updatedAt timestamp', () => {
            manager.createTask('t2');
            manager.start_task('t2');
            const before = Date.now();
            const entry = manager.close_task('t2');
            assert.ok(entry.updatedAt >= before);
        });

        it('persists status change to disk', () => {
            manager.createTask('t2');
            manager.start_task('t2');
            manager.close_task('t2');
            const manager2 = new TaskManager(workspaceRoot);
            assert.strictEqual(manager2.listTasks()[0].status, TaskStatus.Closed);
        });
    });

    // ── State machine: invalid transitions ─────────────────────────────────

    describe('invalid state transitions', () => {
        it('start_task throws when task does not exist', () => {
            assert.throws(
                () => manager.start_task('ghost'),
                /Task 'ghost' not found\./
            );
        });

        it('start_task throws when status is in-progress (exact message)', () => {
            manager.createTask('t3');
            manager.start_task('t3');
            assert.throws(
                () => manager.start_task('t3'),
                /Cannot start task 't3': current status is 'in-progress', expected 'open'\./
            );
        });

        it('start_task throws when status is closed (exact message)', () => {
            manager.createTask('t4');
            manager.start_task('t4');
            manager.close_task('t4');
            assert.throws(
                () => manager.start_task('t4'),
                /Cannot start task 't4': current status is 'closed', expected 'open'\./
            );
        });

        it('close_task throws when task does not exist', () => {
            assert.throws(
                () => manager.close_task('ghost'),
                /Task 'ghost' not found\./
            );
        });

        it('close_task throws when status is open (exact message with hint)', () => {
            manager.createTask('t5');
            assert.throws(
                () => manager.close_task('t5'),
                /Cannot close task 't5': current status is 'open', expected 'in-progress'\. Use 'start_task' first\./
            );
        });

        it('close_task throws when status is already closed (exact message)', () => {
            manager.createTask('t6');
            manager.start_task('t6');
            manager.close_task('t6');
            assert.throws(
                () => manager.close_task('t6'),
                /Cannot close task 't6': current status is 'closed', expected 'in-progress'\. Use 'start_task' first\./
            );
        });
    });
});
