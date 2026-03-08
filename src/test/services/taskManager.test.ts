import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager } from '../../services/taskManager.js';
import { TaskStatus } from '../../models/task.js';

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

suite('TaskManager', () => {
    let workspaceRoot: string;
    let manager: TaskManager;

    setup(() => {
        workspaceRoot = makeTmpWorkspace();
        manager = new TaskManager(workspaceRoot);
    });

    teardown(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    // ── Lazy initialisation ────────────────────────────────────────────────

    suite('lazy initialisation', () => {
        test('does NOT create .tasks/ on construction', () => {
            const tasksDir = path.join(workspaceRoot, '.tasks');
            assert.strictEqual(fs.existsSync(tasksDir), false, '.tasks/ should not exist yet');
        });

        test('creates .tasks/ and index.json on first write (createTask)', () => {
            manager.createTask('first-task');
            const indexPath = path.join(workspaceRoot, '.tasks', 'index.json');
            assert.ok(fs.existsSync(indexPath), 'index.json should be created after first write');
        });

        test('index.json contains valid JSON after first write', () => {
            manager.createTask('first-task');
            const indexPath = path.join(workspaceRoot, '.tasks', 'index.json');
            const raw = fs.readFileSync(indexPath, 'utf-8');
            assert.doesNotThrow(() => JSON.parse(raw), 'index.json should be valid JSON');
        });

        test('listTasks returns empty array before any writes', () => {
            const tasks = manager.listTasks();
            assert.deepStrictEqual(tasks, []);
        });

        test('getActiveTask returns null before any writes', () => {
            assert.strictEqual(manager.getActiveTask(), null);
        });
    });

    // ── CRUD operations ────────────────────────────────────────────────────

    suite('createTask', () => {
        test('returns a TaskEntry with correct id and open status', () => {
            const entry = manager.createTask('my-task');
            assert.strictEqual(entry.id, 'my-task');
            assert.strictEqual(entry.status, TaskStatus.Open);
        });

        test('sets createdAt and updatedAt to approximately now', () => {
            const before = Date.now();
            const entry = manager.createTask('my-task');
            const after = Date.now();
            assert.ok(entry.createdAt >= before && entry.createdAt <= after);
            assert.ok(entry.updatedAt >= before && entry.updatedAt <= after);
        });

        test('persists task across manager instances (reads from disk)', () => {
            manager.createTask('persisted-task');
            const manager2 = new TaskManager(workspaceRoot);
            const tasks = manager2.listTasks();
            assert.strictEqual(tasks.length, 1);
            assert.strictEqual(tasks[0].id, 'persisted-task');
        });

        test('throws when id already exists', () => {
            manager.createTask('dup-task');
            assert.throws(
                () => manager.createTask('dup-task'),
                /Task 'dup-task' already exists\./
            );
        });
    });

    suite('listTasks', () => {
        setup(() => {
            manager.createTask('task-a'); // open
            manager.createTask('task-b'); // will become in-progress
            manager.createTask('task-c'); // will become closed
            manager.start_task('task-b');
            manager.start_task('task-c');
            manager.close_task('task-c');
        });

        test('returns all tasks when no filter is given', () => {
            assert.strictEqual(manager.listTasks().length, 3);
        });

        test('filters by open status', () => {
            const result = manager.listTasks(TaskStatus.Open);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'task-a');
        });

        test('filters by in-progress status', () => {
            const result = manager.listTasks(TaskStatus.InProgress);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'task-b');
        });

        test('filters by closed status', () => {
            const result = manager.listTasks(TaskStatus.Closed);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'task-c');
        });

        test('returns empty array for filter with no matches', () => {
            // All tasks created fresh in a new workspace
            const emptyManager = new TaskManager(makeTmpWorkspace());
            const result = emptyManager.listTasks(TaskStatus.Closed);
            assert.deepStrictEqual(result, []);
        });
    });

    // ── Activation / Deactivation ──────────────────────────────────────────

    suite('activateTask / deactivateTask / getActiveTask', () => {
        test('activates a task and getActiveTask returns it', () => {
            manager.createTask('task-x');
            manager.activateTask('task-x');
            const active = manager.getActiveTask();
            assert.ok(active);
            assert.strictEqual(active.id, 'task-x');
        });

        test('only one task can be active at a time', () => {
            manager.createTask('task-1');
            manager.createTask('task-2');
            manager.activateTask('task-1');
            manager.activateTask('task-2');
            assert.strictEqual(manager.getActiveTask()?.id, 'task-2');
        });

        test('deactivateTask clears the active task', () => {
            manager.createTask('task-x');
            manager.activateTask('task-x');
            manager.deactivateTask();
            assert.strictEqual(manager.getActiveTask(), null);
        });

        test('deactivateTask is idempotent when no task is active', () => {
            assert.doesNotThrow(() => manager.deactivateTask());
        });

        test('activateTask throws for non-existent task', () => {
            assert.throws(
                () => manager.activateTask('no-such-task'),
                /Cannot activate task 'no-such-task': task not found\./
            );
        });
    });

    // ── State machine: valid transitions ───────────────────────────────────

    suite('start_task (open → in-progress)', () => {
        test('transitions status to in-progress', () => {
            manager.createTask('t1');
            const entry = manager.start_task('t1');
            assert.strictEqual(entry.status, TaskStatus.InProgress);
        });

        test('updates updatedAt timestamp', () => {
            manager.createTask('t1');
            const before = Date.now();
            const entry = manager.start_task('t1');
            assert.ok(entry.updatedAt >= before);
        });

        test('persists status change to disk', () => {
            manager.createTask('t1');
            manager.start_task('t1');
            const manager2 = new TaskManager(workspaceRoot);
            assert.strictEqual(manager2.listTasks()[0].status, TaskStatus.InProgress);
        });
    });

    suite('close_task (in-progress → closed)', () => {
        test('transitions status to closed', () => {
            manager.createTask('t2');
            manager.start_task('t2');
            const entry = manager.close_task('t2');
            assert.strictEqual(entry.status, TaskStatus.Closed);
        });

        test('updates updatedAt timestamp', () => {
            manager.createTask('t2');
            manager.start_task('t2');
            const before = Date.now();
            const entry = manager.close_task('t2');
            assert.ok(entry.updatedAt >= before);
        });

        test('persists status change to disk', () => {
            manager.createTask('t2');
            manager.start_task('t2');
            manager.close_task('t2');
            const manager2 = new TaskManager(workspaceRoot);
            assert.strictEqual(manager2.listTasks()[0].status, TaskStatus.Closed);
        });
    });

    // ── State machine: invalid transitions ─────────────────────────────────

    suite('invalid state transitions', () => {
        test('start_task throws when task does not exist', () => {
            assert.throws(
                () => manager.start_task('ghost'),
                /Task 'ghost' not found\./
            );
        });

        test('start_task throws when status is in-progress (exact message)', () => {
            manager.createTask('t3');
            manager.start_task('t3');
            assert.throws(
                () => manager.start_task('t3'),
                /Cannot start task 't3': current status is 'in-progress', expected 'open'\./
            );
        });

        test('start_task throws when status is closed (exact message)', () => {
            manager.createTask('t4');
            manager.start_task('t4');
            manager.close_task('t4');
            assert.throws(
                () => manager.start_task('t4'),
                /Cannot start task 't4': current status is 'closed', expected 'open'\./
            );
        });

        test('close_task throws when task does not exist', () => {
            assert.throws(
                () => manager.close_task('ghost'),
                /Task 'ghost' not found\./
            );
        });

        test('close_task throws when status is open (exact message with hint)', () => {
            manager.createTask('t5');
            assert.throws(
                () => manager.close_task('t5'),
                /Cannot close task 't5': current status is 'open', expected 'in-progress'\. Use 'start_task' first\./
            );
        });

        test('close_task throws when status is already closed (exact message)', () => {
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
