/**
 * Unit tests for task tool handlers.
 *
 * Tests exercise the pure handler functions in `src/handlers/taskHandlers.ts`
 * directly, passing an isolated `TaskManager` backed by a temp directory.
 * No MCP transport or server wiring is involved.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager } from '@tasklist/core';
import {
    handleListTasks,
    handleCreateTask,
    handleActivateTask,
    handleDeactivateTask,
    handleStartTask,
    handleCloseTask,
} from '../src/handlers/taskHandlers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-mcp-task-test-'));
}

function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

/** Extracts the plain text from the first content item. */
function text(result: { content: Array<{ text: string }> }): string {
    return result.content[0].text;
}

/** Returns true if the result is an error response. */
function isError(result: { isError?: boolean }): boolean {
    return result.isError === true;
}

// ─── Suites ──────────────────────────────────────────────────────────────────

suite('Task Tool Handlers', () => {
    let workspaceRoot: string;
    let manager: TaskManager;

    setup(() => {
        workspaceRoot = makeTmpWorkspace();
        manager = new TaskManager(workspaceRoot);
    });

    teardown(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleListTasks
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleListTasks', () => {
        test('returns "No tasks found" message when workspace is empty', async () => {
            const result = await handleListTasks(manager, {});
            assert.ok(text(result).includes('No tasks found'), text(result));
            assert.ok(!isError(result));
        });

        test('lists all tasks when no status filter is provided', async () => {
            manager.createTask('task-a');
            manager.createTask('task-b');
            const result = await handleListTasks(manager, {});
            assert.ok(!isError(result));
            assert.ok(text(result).includes('task-a'), text(result));
            assert.ok(text(result).includes('task-b'), text(result));
            assert.ok(text(result).includes('2 task(s)'), text(result));
        });

        test('filters by "open" status', async () => {
            manager.createTask('open-task');
            manager.createTask('ip-task');
            manager.start_task('ip-task');
            const result = await handleListTasks(manager, { status: 'open' });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('open-task'), text(result));
            assert.ok(!text(result).includes('ip-task'), text(result));
        });

        test('filters by "in-progress" status', async () => {
            manager.createTask('open-task');
            manager.createTask('ip-task');
            manager.start_task('ip-task');
            const result = await handleListTasks(manager, { status: 'in-progress' });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('ip-task'), text(result));
            assert.ok(!text(result).includes('open-task'), text(result));
        });

        test('filters by "closed" status', async () => {
            manager.createTask('closed-task');
            manager.start_task('closed-task');
            manager.close_task('closed-task');
            manager.createTask('open-task');
            const result = await handleListTasks(manager, { status: 'closed' });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('closed-task'), text(result));
            assert.ok(!text(result).includes('open-task'), text(result));
        });

        test('returns "No tasks found" with status context when filter has no matches', async () => {
            const result = await handleListTasks(manager, { status: 'closed' });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('No tasks found'), text(result));
            assert.ok(text(result).includes('closed'), text(result));
        });

        test('returns isError for an invalid status value', async () => {
            const result = await handleListTasks(manager, { status: 'pending' });
            assert.ok(isError(result), 'Expected isError for invalid status');
            assert.ok(text(result).includes('pending'), text(result));
            assert.ok(text(result).includes('open'), text(result));
            assert.ok(text(result).includes('in-progress'), text(result));
            assert.ok(text(result).includes('closed'), text(result));
        });

        test('error message for invalid status includes retry guidance', async () => {
            const result = await handleListTasks(manager, { status: 'bad-status' });
            assert.ok(isError(result));
            const t = text(result).toLowerCase();
            assert.ok(t.includes('retry') || t.includes('please'), text(result));
        });

        test('result includes task id, status bracket, and timestamps', async () => {
            manager.createTask('detailed-task');
            const result = await handleListTasks(manager, {});
            assert.ok(!isError(result));
            assert.ok(text(result).includes('detailed-task'), text(result));
            assert.ok(text(result).includes('[open]'), text(result));
            assert.ok(text(result).includes('created:'), text(result));
            assert.ok(text(result).includes('updated:'), text(result));
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleCreateTask
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleCreateTask', () => {
        test('creates a task and returns success message', async () => {
            const result = await handleCreateTask(manager, { taskId: 'new-task' });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('new-task'), text(result));
            assert.ok(text(result).includes('created'), text(result));
        });

        test('success message mentions "open" initial status', async () => {
            const result = await handleCreateTask(manager, { taskId: 'another-task' });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('open'), text(result));
        });

        test('actually persists the task in the manager', async () => {
            await handleCreateTask(manager, { taskId: 'persisted-task' });
            const tasks = manager.listTasks();
            assert.strictEqual(tasks.length, 1);
            assert.strictEqual(tasks[0].id, 'persisted-task');
        });

        test('returns isError for an empty taskId', async () => {
            const result = await handleCreateTask(manager, { taskId: '' });
            assert.ok(isError(result));
            const t = text(result).toLowerCase();
            assert.ok(t.includes('non-empty') || t.includes('empty'), text(result));
        });

        test('returns isError with guidance when taskId already exists', async () => {
            manager.createTask('dup-task');
            const result = await handleCreateTask(manager, { taskId: 'dup-task' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('dup-task'), text(result));
            assert.ok(
                text(result).includes('already exists') || text(result).includes('Cannot create'),
                text(result)
            );
            assert.ok(
                text(result).includes('list_tasks') || text(result).includes('different'),
                `Expected corrective guidance in: "${text(result)}"`
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleActivateTask
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleActivateTask', () => {
        test('activates a task and returns success message', async () => {
            manager.createTask('task-x');
            const result = await handleActivateTask(manager, { taskId: 'task-x' });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('task-x'), text(result));
            assert.ok(text(result).includes('active'), text(result));
        });

        test('actually marks the task active in the index', async () => {
            manager.createTask('task-x');
            await handleActivateTask(manager, { taskId: 'task-x' });
            assert.strictEqual(manager.getActiveTask()?.id, 'task-x');
        });

        test('returns isError for a non-existent taskId', async () => {
            const result = await handleActivateTask(manager, { taskId: 'ghost' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('ghost'), text(result));
            assert.ok(text(result).includes('not found'), text(result));
        });

        test('error message suggests using list_tasks', async () => {
            const result = await handleActivateTask(manager, { taskId: 'ghost' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('list_tasks'), text(result));
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleDeactivateTask
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleDeactivateTask', () => {
        test('returns success message when a task was active', async () => {
            manager.createTask('task-y');
            manager.activateTask('task-y');
            const result = await handleDeactivateTask(manager);
            assert.ok(!isError(result));
            const t = text(result).toLowerCase();
            assert.ok(t.includes('cleared') || t.includes('no task'), text(result));
        });

        test('actually clears the active task in the index', async () => {
            manager.createTask('task-y');
            manager.activateTask('task-y');
            await handleDeactivateTask(manager);
            assert.strictEqual(manager.getActiveTask(), null);
        });

        test('is idempotent when no task is active', async () => {
            const result = await handleDeactivateTask(manager);
            assert.ok(!isError(result), 'Should succeed even with no active task');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleStartTask
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleStartTask', () => {
        test('transitions an open task to in-progress and returns success', async () => {
            manager.createTask('start-me');
            const result = await handleStartTask(manager, { taskId: 'start-me' });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('start-me'), text(result));
            assert.ok(text(result).includes('in-progress'), text(result));
        });

        test('actually transitions the task status on disk', async () => {
            manager.createTask('start-me');
            await handleStartTask(manager, { taskId: 'start-me' });
            const tasks = manager.listTasks();
            assert.strictEqual(tasks[0].status, 'in-progress');
        });

        test('returns isError for a non-existent taskId', async () => {
            const result = await handleStartTask(manager, { taskId: 'ghost' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('ghost'), text(result));
            assert.ok(text(result).includes('not found'), text(result));
        });

        test('error for non-existent task includes list_tasks suggestion', async () => {
            const result = await handleStartTask(manager, { taskId: 'ghost' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('list_tasks'), text(result));
        });

        test('returns isError when task is already in-progress', async () => {
            manager.createTask('t-ip');
            manager.start_task('t-ip');
            const result = await handleStartTask(manager, { taskId: 't-ip' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('t-ip'), text(result));
            assert.ok(text(result).includes('in-progress'), text(result));
        });

        test('returns isError when task is already closed', async () => {
            manager.createTask('t-closed');
            manager.start_task('t-closed');
            manager.close_task('t-closed');
            const result = await handleStartTask(manager, { taskId: 't-closed' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('t-closed'), text(result));
        });

        test('error for invalid transition includes status inspection hint', async () => {
            manager.createTask('t-ip');
            manager.start_task('t-ip');
            const result = await handleStartTask(manager, { taskId: 't-ip' });
            assert.ok(isError(result));
            const t = text(result);
            assert.ok(
                t.includes('list_tasks') || t.includes('status'),
                `Expected status hint in: "${t}"`
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleCloseTask
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleCloseTask', () => {
        test('transitions an in-progress task to closed and returns success', async () => {
            manager.createTask('close-me');
            manager.start_task('close-me');
            const result = await handleCloseTask(manager, { taskId: 'close-me' });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('close-me'), text(result));
            assert.ok(text(result).includes('closed'), text(result));
        });

        test('actually transitions the task status on disk', async () => {
            manager.createTask('close-me');
            manager.start_task('close-me');
            await handleCloseTask(manager, { taskId: 'close-me' });
            const tasks = manager.listTasks();
            assert.strictEqual(tasks[0].status, 'closed');
        });

        test('returns isError for a non-existent taskId', async () => {
            const result = await handleCloseTask(manager, { taskId: 'ghost' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('ghost'), text(result));
            assert.ok(text(result).includes('not found'), text(result));
        });

        test('error for non-existent task includes list_tasks suggestion', async () => {
            const result = await handleCloseTask(manager, { taskId: 'ghost' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('list_tasks'), text(result));
        });

        test('returns isError when task is still open (never started)', async () => {
            manager.createTask('t-open');
            const result = await handleCloseTask(manager, { taskId: 't-open' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('t-open'), text(result));
        });

        test('error for open task includes start_task hint', async () => {
            manager.createTask('t-open');
            const result = await handleCloseTask(manager, { taskId: 't-open' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('start_task'), text(result));
        });

        test('returns isError when task is already closed', async () => {
            manager.createTask('t-done');
            manager.start_task('t-done');
            manager.close_task('t-done');
            const result = await handleCloseTask(manager, { taskId: 't-done' });
            assert.ok(isError(result));
            assert.ok(text(result).includes('t-done'), text(result));
        });
    });
});
