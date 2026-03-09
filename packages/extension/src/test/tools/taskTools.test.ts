import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { TaskManager } from '@tasklist/core';
import { ListTasksTool } from '../../tools/listTasksTool.js';
import { CreateTaskTool } from '../../tools/createTaskTool.js';
import { ActivateTaskTool } from '../../tools/activateTaskTool.js';
import { DeactivateTaskTool } from '../../tools/deactivateTaskTool.js';
import { StartTaskTool } from '../../tools/startTaskTool.js';
import { CloseTaskTool } from '../../tools/closeTaskTool.js';
import { IListTasksParams, ICreateTaskParams, ITaskIdParams } from '../../tools/interfaces.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Creates an isolated temp directory for a test workspace. */
function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-tools-test-'));
}

/** Removes the temp directory and all its contents. */
function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * A stub `CancellationToken` that is never cancelled.
 * Used to satisfy the `vscode.CancellationToken` parameter shape in
 * `invoke` and `prepareInvocation` calls without requiring a real token.
 */
const NEVER_TOKEN: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: new vscode.EventEmitter<unknown>().event,
};

/**
 * Builds a fake `LanguageModelToolInvocationOptions<T>` object suitable for
 * passing to `tool.invoke()` in tests. VS Code validates the input at call
 * time; for unit tests we only need the `input` property.
 */
function makeInvokeOptions<T>(input: T): vscode.LanguageModelToolInvocationOptions<T> {
    return { input } as vscode.LanguageModelToolInvocationOptions<T>;
}

/**
 * Builds a fake `LanguageModelToolInvocationPrepareOptions<T>` for
 * `tool.prepareInvocation()` tests.
 */
function makePrepareOptions<T>(input: T): vscode.LanguageModelToolInvocationPrepareOptions<T> {
    return { input } as vscode.LanguageModelToolInvocationPrepareOptions<T>;
}

/**
 * Extracts the plain-text content from the first `LanguageModelTextPart`
 * inside a `LanguageModelToolResult`.
 */
function firstTextPart(result: vscode.LanguageModelToolResult): string {
    const part = result.content[0];
    if (part instanceof vscode.LanguageModelTextPart) {
        return part.value;
    }
    throw new Error('Expected first content item to be a LanguageModelTextPart');
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

suite('Task Management Tools', () => {
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
    // ListTasksTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('ListTasksTool', () => {
        let tool: ListTasksTool;

        setup(() => {
            tool = new ListTasksTool(manager);
        });

        // ── invoke: happy-path ───────────────────────────────────────────

        test('invoke returns "No tasks found" message when workspace is empty', async () => {
            const result = await tool.invoke(makeInvokeOptions<IListTasksParams>({}), NEVER_TOKEN);
            const text = firstTextPart(result);
            assert.ok(text.includes('No tasks found'), `Expected "No tasks found" in: "${text}"`);
        });

        test('invoke lists all tasks when no status filter is provided', async () => {
            manager.createTask('task-a');
            manager.createTask('task-b');
            const result = await tool.invoke(makeInvokeOptions<IListTasksParams>({}), NEVER_TOKEN);
            const text = firstTextPart(result);
            assert.ok(text.includes('task-a'), text);
            assert.ok(text.includes('task-b'), text);
            assert.ok(text.includes('2 task(s)'), text);
        });

        test('invoke filters by "open" status', async () => {
            manager.createTask('open-task');
            manager.createTask('ip-task');
            manager.start_task('ip-task');
            const result = await tool.invoke(
                makeInvokeOptions<IListTasksParams>({ status: 'open' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('open-task'), text);
            assert.ok(!text.includes('ip-task'), text);
        });

        test('invoke filters by "in-progress" status', async () => {
            manager.createTask('open-task');
            manager.createTask('ip-task');
            manager.start_task('ip-task');
            const result = await tool.invoke(
                makeInvokeOptions<IListTasksParams>({ status: 'in-progress' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('ip-task'), text);
            assert.ok(!text.includes('open-task'), text);
        });

        test('invoke filters by "closed" status', async () => {
            manager.createTask('closed-task');
            manager.start_task('closed-task');
            manager.close_task('closed-task');
            manager.createTask('open-task');
            const result = await tool.invoke(
                makeInvokeOptions<IListTasksParams>({ status: 'closed' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('closed-task'), text);
            assert.ok(!text.includes('open-task'), text);
        });

        test('invoke returns "No tasks found" with context when filter has no matches', async () => {
            // No tasks at all — filtering for "closed" should say nothing found.
            const result = await tool.invoke(
                makeInvokeOptions<IListTasksParams>({ status: 'closed' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('No tasks found'), text);
            assert.ok(text.includes('closed'), text);
        });

        test('invoke result includes task id, status, and timestamps', async () => {
            manager.createTask('detailed-task');
            const result = await tool.invoke(makeInvokeOptions<IListTasksParams>({}), NEVER_TOKEN);
            const text = firstTextPart(result);
            assert.ok(text.includes('detailed-task'), text);
            assert.ok(text.includes('[open]'), text);
            assert.ok(text.includes('created:'), text);
            assert.ok(text.includes('updated:'), text);
        });

        // ── invoke: error handling ───────────────────────────────────────

        test('invoke throws with helpful message for unrecognised status value', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<IListTasksParams>({ status: 'pending' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('pending'), err.message);
                    assert.ok(err.message.includes('open'), err.message);
                    assert.ok(err.message.includes('in-progress'), err.message);
                    assert.ok(err.message.includes('closed'), err.message);
                    return true;
                }
            );
        });

        test('invoke throw message suggests retry with a valid value', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<IListTasksParams>({ status: 'bad-status' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.toLowerCase().includes('retry') || err.message.toLowerCase().includes('please'), err.message);
                    return true;
                }
            );
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation returns an invocationMessage without filter', async () => {
            const prep = await tool.prepareInvocation(makePrepareOptions<IListTasksParams>({}), NEVER_TOKEN);
            assert.ok(prep.invocationMessage, 'invocationMessage should be present');
            assert.ok(typeof prep.invocationMessage === 'string', 'invocationMessage should be a string');
        });

        test('prepareInvocation invocationMessage includes the status filter when provided', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IListTasksParams>({ status: 'open' }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes('open'), prep.invocationMessage as string);
        });

        test('prepareInvocation returns confirmationMessages', async () => {
            const prep = await tool.prepareInvocation(makePrepareOptions<IListTasksParams>({}), NEVER_TOKEN);
            assert.ok(prep.confirmationMessages, 'confirmationMessages should be present');
            assert.ok(prep.confirmationMessages?.title, 'title should be present');
            assert.ok(prep.confirmationMessages?.message, 'message should be present');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // CreateTaskTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('CreateTaskTool', () => {
        let tool: CreateTaskTool;

        setup(() => {
            tool = new CreateTaskTool(manager);
        });

        // ── invoke: happy-path ───────────────────────────────────────────

        test('invoke creates a task and returns success message', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<ICreateTaskParams>({ taskId: 'new-task' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('new-task'), text);
            assert.ok(text.includes('created'), text);
        });

        test('invoke result mentions the "open" initial status', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<ICreateTaskParams>({ taskId: 'another-task' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('open'), text);
        });

        test('invoke actually persists the task to disk', async () => {
            await tool.invoke(
                makeInvokeOptions<ICreateTaskParams>({ taskId: 'persisted-task' }),
                NEVER_TOKEN
            );
            const tasks = manager.listTasks();
            assert.strictEqual(tasks.length, 1);
            assert.strictEqual(tasks[0].id, 'persisted-task');
        });

        // ── invoke: error handling ───────────────────────────────────────

        test('invoke throws for an empty taskId', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ICreateTaskParams>({ taskId: '' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.toLowerCase().includes('non-empty') || err.message.toLowerCase().includes('empty'), err.message);
                    return true;
                }
            );
        });

        test('invoke throws with helpful guidance when taskId already exists', async () => {
            manager.createTask('dup-task');
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ICreateTaskParams>({ taskId: 'dup-task' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('dup-task'), err.message);
                    assert.ok(err.message.includes('already exists') || err.message.includes('Cannot create'), err.message);
                    // Should suggest a corrective action.
                    assert.ok(
                        err.message.includes('list_tasks') || err.message.includes('different'),
                        `Expected corrective guidance in: "${err.message}"`
                    );
                    return true;
                }
            );
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation invocationMessage contains the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ICreateTaskParams>({ taskId: 'my-feature' }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes('my-feature'), prep.invocationMessage as string);
        });

        test('prepareInvocation confirmation title is non-empty', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ICreateTaskParams>({ taskId: 'x' }),
                NEVER_TOKEN
            );
            assert.ok(prep.confirmationMessages?.title, 'title should be non-empty');
        });

        test('prepareInvocation confirmation message references the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ICreateTaskParams>({ taskId: 'feature-x' }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message;
            assert.ok(msg instanceof vscode.MarkdownString, 'message should be a MarkdownString');
            assert.ok(
                (msg as vscode.MarkdownString).value.includes('feature-x'),
                (msg as vscode.MarkdownString).value
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ActivateTaskTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('ActivateTaskTool', () => {
        let tool: ActivateTaskTool;

        setup(() => {
            tool = new ActivateTaskTool(manager);
        });

        // ── invoke: happy-path ───────────────────────────────────────────

        test('invoke activates a task and returns success message', async () => {
            manager.createTask('task-x');
            const result = await tool.invoke(
                makeInvokeOptions<ITaskIdParams>({ taskId: 'task-x' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('task-x'), text);
            assert.ok(text.includes('active'), text);
        });

        test('invoke actually marks the task active in the index', async () => {
            manager.createTask('task-x');
            await tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'task-x' }), NEVER_TOKEN);
            assert.strictEqual(manager.getActiveTask()?.id, 'task-x');
        });

        // ── invoke: error handling ───────────────────────────────────────

        test('invoke throws for a non-existent taskId', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'ghost' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('ghost'), err.message);
                    assert.ok(err.message.includes('not found'), err.message);
                    return true;
                }
            );
        });

        test('invoke error message suggests using list_tasks to find valid IDs', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'ghost' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('list_tasks'), err.message);
                    return true;
                }
            );
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation invocationMessage contains the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: 'my-task' }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes('my-task'), prep.invocationMessage as string);
        });

        test('prepareInvocation confirmation message references the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: 'some-task' }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(msg.value.includes('some-task'), msg.value);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // DeactivateTaskTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('DeactivateTaskTool', () => {
        let tool: DeactivateTaskTool;

        setup(() => {
            tool = new DeactivateTaskTool(manager);
        });

        // ── invoke: happy-path ───────────────────────────────────────────

        test('invoke deactivates the current task and returns success message', async () => {
            manager.createTask('task-y');
            manager.activateTask('task-y');
            const result = await tool.invoke(
                makeInvokeOptions<ITaskIdParams>({ taskId: 'task-y' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.toLowerCase().includes('cleared') || text.toLowerCase().includes('no task'), text);
        });

        test('invoke actually clears the active task in the index', async () => {
            manager.createTask('task-y');
            manager.activateTask('task-y');
            await tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'task-y' }), NEVER_TOKEN);
            assert.strictEqual(manager.getActiveTask(), null);
        });

        test('invoke is idempotent when no task is active', async () => {
            // No active task — should still succeed without error.
            await assert.doesNotReject(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: '' }), NEVER_TOKEN)
            );
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation returns a non-empty invocationMessage', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: '' }),
                NEVER_TOKEN
            );
            assert.ok(prep.invocationMessage, 'invocationMessage should be non-empty');
        });

        test('prepareInvocation returns confirmationMessages with title and message', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: '' }),
                NEVER_TOKEN
            );
            assert.ok(prep.confirmationMessages?.title, 'title should be present');
            assert.ok(prep.confirmationMessages?.message, 'message should be present');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // StartTaskTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('StartTaskTool', () => {
        let tool: StartTaskTool;

        setup(() => {
            tool = new StartTaskTool(manager);
        });

        // ── invoke: happy-path ───────────────────────────────────────────

        test('invoke transitions an open task to in-progress and returns success message', async () => {
            manager.createTask('start-me');
            const result = await tool.invoke(
                makeInvokeOptions<ITaskIdParams>({ taskId: 'start-me' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('start-me'), text);
            assert.ok(text.includes('in-progress'), text);
        });

        test('invoke actually transitions the task status on disk', async () => {
            manager.createTask('start-me');
            await tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'start-me' }), NEVER_TOKEN);
            const tasks = manager.listTasks();
            assert.strictEqual(tasks[0].status, 'in-progress');
        });

        // ── invoke: error handling (invalid taskId) ──────────────────────

        test('invoke throws for a non-existent taskId', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'ghost' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('ghost'), err.message);
                    assert.ok(err.message.includes('not found'), err.message);
                    return true;
                }
            );
        });

        test('invoke error includes list_tasks suggestion for non-existent taskId', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'ghost' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('list_tasks'), err.message);
                    return true;
                }
            );
        });

        // ── invoke: error handling (invalid state transitions) ───────────

        test('invoke throws with guidance when task is already in-progress', async () => {
            manager.createTask('t-ip');
            manager.start_task('t-ip');
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 't-ip' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('t-ip'), err.message);
                    assert.ok(err.message.includes('in-progress'), err.message);
                    return true;
                }
            );
        });

        test('invoke throws with guidance when task is already closed', async () => {
            manager.createTask('t-closed');
            manager.start_task('t-closed');
            manager.close_task('t-closed');
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 't-closed' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('t-closed'), err.message);
                    assert.ok(err.message.includes('closed') || err.message.includes('open'), err.message);
                    return true;
                }
            );
        });

        test('invoke error for invalid transition suggests inspecting task status', async () => {
            manager.createTask('t-ip');
            manager.start_task('t-ip');
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 't-ip' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(
                        err.message.includes('list_tasks') || err.message.includes('status'),
                        `Expected status inspection hint in: "${err.message}"`
                    );
                    return true;
                }
            );
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation invocationMessage contains the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: 'work-item' }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes('work-item'), prep.invocationMessage as string);
        });

        test('prepareInvocation confirmation message references the open → in-progress transition', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: 'work-item' }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(msg.value.includes('open') || msg.value.includes('in-progress'), msg.value);
        });

        test('prepareInvocation confirmation message contains the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: 'work-item' }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(msg.value.includes('work-item'), msg.value);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // CloseTaskTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('CloseTaskTool', () => {
        let tool: CloseTaskTool;

        setup(() => {
            tool = new CloseTaskTool(manager);
        });

        // ── invoke: happy-path ───────────────────────────────────────────

        test('invoke transitions an in-progress task to closed and returns success message', async () => {
            manager.createTask('close-me');
            manager.start_task('close-me');
            const result = await tool.invoke(
                makeInvokeOptions<ITaskIdParams>({ taskId: 'close-me' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('close-me'), text);
            assert.ok(text.includes('closed'), text);
        });

        test('invoke actually transitions the task status on disk', async () => {
            manager.createTask('close-me');
            manager.start_task('close-me');
            await tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'close-me' }), NEVER_TOKEN);
            const tasks = manager.listTasks();
            assert.strictEqual(tasks[0].status, 'closed');
        });

        // ── invoke: error handling (invalid taskId) ──────────────────────

        test('invoke throws for a non-existent taskId', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'ghost' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('ghost'), err.message);
                    assert.ok(err.message.includes('not found'), err.message);
                    return true;
                }
            );
        });

        test('invoke error includes list_tasks suggestion for non-existent taskId', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 'ghost' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('list_tasks'), err.message);
                    return true;
                }
            );
        });

        // ── invoke: error handling (invalid state transitions) ───────────

        test('invoke throws with guidance when task is still open (never started)', async () => {
            manager.createTask('t-open');
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 't-open' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('t-open'), err.message);
                    assert.ok(err.message.includes('open') || err.message.includes('in-progress'), err.message);
                    return true;
                }
            );
        });

        test('invoke error for open task includes start_task hint', async () => {
            manager.createTask('t-open');
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 't-open' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('start_task'), err.message);
                    return true;
                }
            );
        });

        test('invoke throws with guidance when task is already closed', async () => {
            manager.createTask('t-done');
            manager.start_task('t-done');
            manager.close_task('t-done');
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<ITaskIdParams>({ taskId: 't-done' }), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('t-done'), err.message);
                    assert.ok(err.message.includes('closed') || err.message.includes('in-progress'), err.message);
                    return true;
                }
            );
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation invocationMessage contains the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: 'done-task' }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes('done-task'), prep.invocationMessage as string);
        });

        test('prepareInvocation confirmation message references the in-progress → closed transition', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: 'done-task' }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(msg.value.includes('in-progress') || msg.value.includes('closed'), msg.value);
        });

        test('prepareInvocation confirmation message contains the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<ITaskIdParams>({ taskId: 'done-task' }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(msg.value.includes('done-task'), msg.value);
        });
    });
});
