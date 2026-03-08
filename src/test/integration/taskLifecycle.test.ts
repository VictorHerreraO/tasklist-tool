import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager } from '../../services/taskManager.js';
import { TaskStatus } from '../../models/task.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-integ-'));
}

function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

/** Reads and parses the raw index.json from a workspace directory. */
function readRawIndex(workspaceRoot: string): { activeTaskId: string | null; tasks: Array<{ id: string; status: string }> } {
    const indexPath = path.join(workspaceRoot, '.tasks', 'index.json');
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

// ─── Suite ───────────────────────────────────────────────────────────────────

suite('Integration – Task Lifecycle', () => {
    let workspaceRoot: string;
    let manager: TaskManager;

    setup(() => {
        workspaceRoot = makeTmpWorkspace();
        manager = new TaskManager(workspaceRoot);
    });

    teardown(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    // ── 1. Full lifecycle with disk verification ──────────────────────────────

    suite('full lifecycle: open → in-progress → closed', () => {
        const TASK_ID = 'lifecycle-task';

        test('createTask creates a task with open status', () => {
            const entry = manager.createTask(TASK_ID);
            assert.strictEqual(entry.id, TASK_ID);
            assert.strictEqual(entry.status, TaskStatus.Open);
        });

        test('index.json reflects open status after create', () => {
            manager.createTask(TASK_ID);
            const raw = readRawIndex(workspaceRoot);
            const found = raw.tasks.find(t => t.id === TASK_ID);
            assert.ok(found, 'Task should appear in index.json');
            assert.strictEqual(found!.status, 'open');
        });

        test('listTasks(open) returns the task after create', () => {
            manager.createTask(TASK_ID);
            const open = manager.listTasks(TaskStatus.Open);
            assert.strictEqual(open.length, 1);
            assert.strictEqual(open[0].id, TASK_ID);
        });

        test('activateTask sets the task as active', () => {
            manager.createTask(TASK_ID);
            manager.activateTask(TASK_ID);
            assert.strictEqual(manager.getActiveTask()?.id, TASK_ID);
        });

        test('index.json reflects activeTaskId after activate', () => {
            manager.createTask(TASK_ID);
            manager.activateTask(TASK_ID);
            const raw = readRawIndex(workspaceRoot);
            assert.strictEqual(raw.activeTaskId, TASK_ID);
        });

        test('start_task transitions status to in-progress', () => {
            manager.createTask(TASK_ID);
            const entry = manager.start_task(TASK_ID);
            assert.strictEqual(entry.status, TaskStatus.InProgress);
        });

        test('listTasks(in-progress) returns the task after start', () => {
            manager.createTask(TASK_ID);
            manager.start_task(TASK_ID);
            const inProgress = manager.listTasks(TaskStatus.InProgress);
            assert.strictEqual(inProgress.length, 1);
            assert.strictEqual(inProgress[0].id, TASK_ID);
        });

        test('index.json reflects in-progress status after start', () => {
            manager.createTask(TASK_ID);
            manager.start_task(TASK_ID);
            const raw = readRawIndex(workspaceRoot);
            const found = raw.tasks.find(t => t.id === TASK_ID);
            assert.strictEqual(found!.status, 'in-progress');
        });

        test('close_task transitions status to closed', () => {
            manager.createTask(TASK_ID);
            manager.start_task(TASK_ID);
            const entry = manager.close_task(TASK_ID);
            assert.strictEqual(entry.status, TaskStatus.Closed);
        });

        test('listTasks(closed) returns the task after close', () => {
            manager.createTask(TASK_ID);
            manager.start_task(TASK_ID);
            manager.close_task(TASK_ID);
            const closed = manager.listTasks(TaskStatus.Closed);
            assert.strictEqual(closed.length, 1);
            assert.strictEqual(closed[0].id, TASK_ID);
        });

        test('index.json reflects closed status after close', () => {
            manager.createTask(TASK_ID);
            manager.start_task(TASK_ID);
            manager.close_task(TASK_ID);
            const raw = readRawIndex(workspaceRoot);
            const found = raw.tasks.find(t => t.id === TASK_ID);
            assert.strictEqual(found!.status, 'closed');
        });

        test('listTasks(open) is empty after task moves to in-progress', () => {
            manager.createTask(TASK_ID);
            manager.start_task(TASK_ID);
            assert.strictEqual(manager.listTasks(TaskStatus.Open).length, 0);
        });

        test('listTasks(in-progress) is empty after task is closed', () => {
            manager.createTask(TASK_ID);
            manager.start_task(TASK_ID);
            manager.close_task(TASK_ID);
            assert.strictEqual(manager.listTasks(TaskStatus.InProgress).length, 0);
        });

        test('state persists across separate TaskManager instances', () => {
            manager.createTask(TASK_ID);
            manager.start_task(TASK_ID);
            manager.close_task(TASK_ID);

            // Fresh instance reading from the same workspace root.
            const manager2 = new TaskManager(workspaceRoot);
            const tasks = manager2.listTasks();
            assert.strictEqual(tasks.length, 1);
            assert.strictEqual(tasks[0].id, TASK_ID);
            assert.strictEqual(tasks[0].status, TaskStatus.Closed);
        });
    });

    // ── 2. Deactivation ───────────────────────────────────────────────────────

    suite('deactivation', () => {
        test('deactivateTask clears active task and getActiveTask returns null', () => {
            manager.createTask('deact-task');
            manager.activateTask('deact-task');
            assert.strictEqual(manager.getActiveTask()?.id, 'deact-task');

            manager.deactivateTask();
            assert.strictEqual(manager.getActiveTask(), null);
        });

        test('index.json shows activeTaskId: null after deactivation', () => {
            manager.createTask('deact-task');
            manager.activateTask('deact-task');
            manager.deactivateTask();
            const raw = readRawIndex(workspaceRoot);
            assert.strictEqual(raw.activeTaskId, null);
        });

        test('deactivateTask is idempotent when no task is currently active', () => {
            // No tasks created at all — should not throw.
            assert.doesNotThrow(() => manager.deactivateTask());
        });

        test('re-activating after deactivation works correctly', () => {
            manager.createTask('task-a');
            manager.activateTask('task-a');
            manager.deactivateTask();
            manager.activateTask('task-a');
            assert.strictEqual(manager.getActiveTask()?.id, 'task-a');
        });

        test('activating a different task replaces the previous active', () => {
            manager.createTask('task-a');
            manager.createTask('task-b');
            manager.activateTask('task-a');
            manager.activateTask('task-b');
            assert.strictEqual(manager.getActiveTask()?.id, 'task-b');
        });
    });

    // ── 3. Multiple tasks ─────────────────────────────────────────────────────

    suite('multiple tasks', () => {
        setup(() => {
            manager.createTask('alpha');
            manager.createTask('beta');
            manager.createTask('gamma');
        });

        test('listTasks() returns all 3 created tasks', () => {
            const all = manager.listTasks();
            assert.strictEqual(all.length, 3);
            const ids = all.map(t => t.id);
            assert.ok(ids.includes('alpha'));
            assert.ok(ids.includes('beta'));
            assert.ok(ids.includes('gamma'));
        });

        test('all 3 tasks start as open', () => {
            const open = manager.listTasks(TaskStatus.Open);
            assert.strictEqual(open.length, 3);
        });

        test('status filter works correctly with heterogeneous tasks', () => {
            manager.start_task('beta');
            manager.start_task('gamma');
            manager.close_task('gamma');

            assert.strictEqual(manager.listTasks(TaskStatus.Open).length, 1);
            assert.strictEqual(manager.listTasks(TaskStatus.InProgress).length, 1);
            assert.strictEqual(manager.listTasks(TaskStatus.Closed).length, 1);
            assert.strictEqual(manager.listTasks(TaskStatus.Open)[0].id, 'alpha');
            assert.strictEqual(manager.listTasks(TaskStatus.InProgress)[0].id, 'beta');
            assert.strictEqual(manager.listTasks(TaskStatus.Closed)[0].id, 'gamma');
        });

        test('activating and closing one task does not affect the others', () => {
            manager.activateTask('alpha');
            manager.start_task('alpha');
            manager.close_task('alpha');

            // beta and gamma remain open
            const open = manager.listTasks(TaskStatus.Open);
            const openIds = open.map(t => t.id);
            assert.ok(openIds.includes('beta'));
            assert.ok(openIds.includes('gamma'));
            assert.ok(!openIds.includes('alpha'));
        });

        test('index.json on disk contains all 3 tasks', () => {
            const raw = readRawIndex(workspaceRoot);
            assert.strictEqual(raw.tasks.length, 3);
        });

        test('state of all tasks survives round-trip through new TaskManager instance', () => {
            manager.start_task('beta');
            manager.start_task('gamma');
            manager.close_task('gamma');

            const manager2 = new TaskManager(workspaceRoot);
            const all = manager2.listTasks();
            assert.strictEqual(all.find(t => t.id === 'alpha')?.status, TaskStatus.Open);
            assert.strictEqual(all.find(t => t.id === 'beta')?.status, TaskStatus.InProgress);
            assert.strictEqual(all.find(t => t.id === 'gamma')?.status, TaskStatus.Closed);
        });
    });
});
