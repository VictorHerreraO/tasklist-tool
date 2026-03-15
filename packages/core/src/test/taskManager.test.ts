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

        it('adds default type="task" to entries missing it from disk (migration)', () => {
            const indexPath = path.join(workspaceRoot, '.tasks', 'index.json');
            fs.mkdirSync(path.dirname(indexPath), { recursive: true });
            const oldIndex = {
                activeTaskId: null,
                tasks: [
                    {
                        id: 'old-task',
                        status: 'open',
                        createdAt: 1000,
                        updatedAt: 1000
                    }
                ]
            };
            fs.writeFileSync(indexPath, JSON.stringify(oldIndex));

            const newManager = new TaskManager(workspaceRoot);
            const tasks = newManager.listTasks();
            assert.strictEqual(tasks[0].type, 'task');
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

        it('defaults to task type', () => {
            const entry = manager.createTask('default-task');
            assert.strictEqual(entry.type, 'task');
        });

        it('supports creating a project type', () => {
            const entry = manager.createTask('my-proj', 'project');
            assert.strictEqual(entry.type, 'project');
        });

        it('supports optional parentTaskId (must be a project)', () => {
            manager.createTask('parent-proj', 'project');
            const entry = manager.createTask('sub-task', 'task', 'parent-proj');
            assert.strictEqual(entry.parentTaskId, 'parent-proj');
        });

        it('throws when parentTaskId does not exist', () => {
            assert.throws(
                () => manager.createTask('sub-task', 'task', 'no-parent'),
                /Parent task 'no-parent' not found\./
            );
        });

        it('throws when parent task is NOT a project', () => {
            manager.createTask('item-task', 'task');
            assert.throws(
                () => manager.createTask('sub-task', 'task', 'item-task'),
                /Parent task 'item-task' is not a project\./
            );
        });

        it('writes subtask to the nested index file', () => {
            manager.createTask('my-proj', 'project');
            manager.createTask('nested-1', 'task', 'my-proj');

            const nestedIndexPath = path.join(workspaceRoot, '.tasks', 'my-proj', 'index.json');
            assert.ok(fs.existsSync(nestedIndexPath), 'Nested index.json should exist');

            const raw = fs.readFileSync(nestedIndexPath, 'utf-8');
            const index = JSON.parse(raw);
            assert.strictEqual(index.tasks.length, 1);
            assert.strictEqual(index.tasks[0].id, 'nested-1');
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

        it('returns all top-level tasks when no filter is given', () => {
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

        describe('hierarchy filtering', () => {
            beforeEach(() => {
                // We already have task-a, task-b, task-c in the outer beforeEach
                manager.promoteTaskToProject('task-a');
                manager.promoteTaskToProject('task-b');
                manager.createTask('sub-1', 'task', 'task-a');
                manager.createTask('sub-2', 'task', 'task-a');
                manager.createTask('sub-3', 'task', 'task-b');
            });

            it('returns only top-level tasks by default', () => {
                const result = manager.listTasks();
                const ids = result.map(t => t.id).sort();
                assert.deepStrictEqual(ids, ['task-a', 'task-b', 'task-c']);
            });

            it('returns subtasks for a specific parent', () => {
                const result = manager.listTasks(undefined, 'task-a');
                const ids = result.map(t => t.id).sort();
                assert.deepStrictEqual(ids, ['sub-1', 'sub-2']);
            });

            it('returns empty array for parent with no subtasks', () => {
                const result = manager.listTasks(undefined, 'task-c');
                assert.deepStrictEqual(result, []);
            });

            it('filters subtasks by status', () => {
                manager.start_task('sub-1', 'task-a');
                const result = manager.listTasks(TaskStatus.InProgress, 'task-a');
                assert.strictEqual(result.length, 1);
                assert.strictEqual(result[0].id, 'sub-1');
            });

            it('subtasks do NOT appear in root index file', () => {
                const rootIndexPath = path.join(workspaceRoot, '.tasks', 'index.json');
                const raw = fs.readFileSync(rootIndexPath, 'utf-8');
                const index = JSON.parse(raw);
                const sub1 = index.tasks.find((t: any) => t.id === 'sub-1');
                assert.strictEqual(sub1, undefined, 'sub-1 should not be in root index');
            });
        });
    });

    describe('promoteTaskToProject', () => {
        it('transitions a task to project type', () => {
            manager.createTask('t-to-p');
            const entry = manager.promoteTaskToProject('t-to-p');
            assert.strictEqual(entry.type, 'project');
        });

        it('creates a dedicated directory and index.json', () => {
            manager.createTask('t-dir');
            manager.promoteTaskToProject('t-dir');

            const projectDir = path.join(workspaceRoot, '.tasks', 't-dir');
            const subIndexPath = path.join(projectDir, 'index.json');

            assert.ok(fs.existsSync(projectDir), 'Project directory should exist');
            assert.ok(fs.statSync(projectDir).isDirectory(), 'Project path should be a directory');
            assert.ok(fs.existsSync(subIndexPath), 'Sub-index.json should exist');

            const raw = fs.readFileSync(subIndexPath, 'utf-8');
            const subIndex = JSON.parse(raw);
            assert.deepStrictEqual(subIndex, { activeTaskId: null, tasks: [] });
        });

        it('updates updatedAt timestamp', () => {
            const entry1 = manager.createTask('t-time');
            const before = Date.now();
            const entry2 = manager.promoteTaskToProject('t-time');
            assert.ok(entry2.updatedAt >= before);
            assert.ok(entry2.updatedAt >= entry1.createdAt);
        });

        it('persists promotion to disk', () => {
            manager.createTask('t-persist');
            manager.promoteTaskToProject('t-persist');

            const manager2 = new TaskManager(workspaceRoot);
            const tasks = manager2.listTasks();
            assert.strictEqual(tasks.find(t => t.id === 't-persist')?.type, 'project');
        });

        it('throws if task does not exist', () => {
            assert.throws(
                () => manager.promoteTaskToProject('no-task'),
                /Task 'no-task' not found\./
            );
        });

        it('throws if task is already a project', () => {
            manager.createTask('already-p', 'project');
            assert.throws(
                () => manager.promoteTaskToProject('already-p'),
                /Task 'already-p' is already a project\./
            );
        });

        it('throws if task is a subtask', () => {
            manager.createTask('parent-p', 'project');
            manager.createTask('sub-t', 'task', 'parent-p');
            assert.throws(
                () => manager.promoteTaskToProject('sub-t'),
                /Cannot promote task 'sub-t' to project: it is a subtask of 'parent-p'/
            );
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

        describe('hierarchical activation and resolution', () => {
            const PROJECT_ID = 'p1';
            const SUBTASK_ID = 's1';

            beforeEach(() => {
                manager.createTask(PROJECT_ID, 'project');
                manager.createTask(SUBTASK_ID, 'task', PROJECT_ID);
            });

            it('getActiveTask resolves nested active task recursively', () => {
                // Activate parent in root index
                manager.activateTask(PROJECT_ID);
                // Activate subtask in parent index
                manager.activateTask(SUBTASK_ID, PROJECT_ID);

                const active = manager.getActiveTask();
                assert.ok(active);
                assert.strictEqual(active.id, SUBTASK_ID);
                assert.strictEqual(active.parentTaskId, PROJECT_ID);
            });

            it('activateTask cascades activation to parent project by default', () => {
                manager.deactivateTask();
                assert.strictEqual(manager.getActiveTask(), null);

                // Activate subtask; should also activate parent in root
                manager.activateTask(SUBTASK_ID, PROJECT_ID);

                const active = manager.getActiveTask();
                assert.strictEqual(active?.id, SUBTASK_ID);

                // Verify root index has PROJECT_ID as active
                const rootIndex = (manager as any).readIndex();
                assert.strictEqual(rootIndex.activeTaskId, PROJECT_ID);
            });

            it('activateTask does NOT cascade if activateProject is false', () => {
                manager.deactivateTask();

                // Activate subtask without cascading
                manager.activateTask(SUBTASK_ID, PROJECT_ID, false);

                // Root active task should still be null
                const rootActive = (manager as any).readIndex().activeTaskId;
                assert.strictEqual(rootActive, null);

                // getActiveTask should return null because root is not active
                assert.strictEqual(manager.getActiveTask(), null);
            });

            it('resolves multiple levels of nesting', () => {
                // Directly create nested project structure
                manager.createTask('p_lvl1', 'project');
                manager.createTask('p_lvl2', 'project', 'p_lvl1');
                manager.createTask('t_lvl3', 'task', 'p_lvl2');

                // Activate chain
                manager.activateTask('p_lvl1');
                manager.activateTask('p_lvl2', 'p_lvl1');
                manager.activateTask('t_lvl3', 'p_lvl2');

                const active = manager.getActiveTask();
                assert.ok(active);
                assert.strictEqual(active.id, 't_lvl3');
            });
        });
    });

    describe('strict hierarchical scoping', () => {
        const PROJECT_ID = 'p1';
        const SUBTASK_ID = 's1';

        beforeEach(() => {
            manager.createTask(PROJECT_ID, 'project');
            manager.createTask(SUBTASK_ID, 'task', PROJECT_ID);
        });

        it('findEntryGlobally does NOT find subtask without parentTaskId', () => {
            const result = manager.findEntryGlobally(SUBTASK_ID);
            assert.strictEqual(result, undefined);
        });

        it('findEntryGlobally finds subtask WITH parentTaskId', () => {
            const result = manager.findEntryGlobally(SUBTASK_ID, PROJECT_ID);
            assert.ok(result);
            assert.strictEqual(result.entry.id, SUBTASK_ID);
        });

        it('taskExists returns false for subtask without parentTaskId', () => {
            assert.strictEqual(manager.taskExists(SUBTASK_ID), false);
        });

        it('taskExists returns true for subtask WITH parentTaskId', () => {
            assert.strictEqual(manager.taskExists(SUBTASK_ID, PROJECT_ID), true);
        });

        it('start_task throws for subtask without parentTaskId', () => {
            assert.throws(
                () => manager.start_task(SUBTASK_ID),
                new RegExp(`Task '${SUBTASK_ID}' not found\\.`)
            );
        });

        it('start_task works for subtask WITH parentTaskId', () => {
            const entry = manager.start_task(SUBTASK_ID, PROJECT_ID);
            assert.strictEqual(entry.status, TaskStatus.InProgress);
        });

        it('close_task throws for subtask without parentTaskId', () => {
            manager.start_task(SUBTASK_ID, PROJECT_ID);
            assert.throws(
                () => manager.close_task(SUBTASK_ID),
                new RegExp(`Task '${SUBTASK_ID}' not found\\.`)
            );
        });

        it('close_task works for subtask WITH parentTaskId', () => {
            manager.start_task(SUBTASK_ID, PROJECT_ID);
            const entry = manager.close_task(SUBTASK_ID, PROJECT_ID);
            assert.strictEqual(entry.status, TaskStatus.Closed);
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
