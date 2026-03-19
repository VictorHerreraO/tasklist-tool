import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager } from '@tasklist/core';
import { resolveTaskContext, mapToolError } from '../../tools/toolUtils.js';

suite('Tool Utilities', () => {
    suite('resolveTaskContext', () => {
        let taskManager: TaskManager;
        let tmpDir: string;

        setup(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-tool-test-'));
            taskManager = new TaskManager(tmpDir);
        });

        teardown(() => {
            if (fs.existsSync(tmpDir)) {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });

        test('should return explicit taskId and parentTaskId when provided', () => {
            const result = resolveTaskContext(taskManager, 'task-1', 'project-1');
            assert.strictEqual(result.taskId, 'task-1');
            assert.strictEqual(result.parentTaskId, 'project-1');
        });

        test('should fallback to active task when no taskId is provided', async () => {
            await taskManager.createTask('active-task', 'task');
            taskManager.activateTask('active-task');

            const result = resolveTaskContext(taskManager, undefined, undefined);
            assert.strictEqual(result.taskId, 'active-task');
            assert.strictEqual(result.parentTaskId, undefined);
        });

        test('should throw an error if no taskId is provided and no task is active', () => {
            assert.throws(() => {
                resolveTaskContext(taskManager, undefined, undefined);
            }, /No taskId was provided and there is no currently active task/);
        });
    });

    suite('mapToolError', () => {
        test('should return a user-friendly error for "not found" messages', () => {
            const rawError = new Error('Task some-id not found');
            const mapped = mapToolError(rawError, 'some-id', 'test operation');
            
            assert.ok(mapped.message.includes("Task 'some-id' not found"));
            assert.ok(mapped.message.includes("AI Agent might have forgot to provide a parent project id"));
        });

        test('should return a standard prefixed error for other messages', () => {
            const rawError = new Error('Permission denied');
            const mapped = mapToolError(rawError, 'some-id', 'test operation');
            
            assert.ok(mapped.message.includes("Failed to test operation for task 'some-id'"));
            assert.ok(mapped.message.includes("Permission denied"));
        });

        test('should handle raw string errors', () => {
            const mapped = mapToolError('Unexpected failure', 'some-id', 'test operation');
            
            assert.ok(mapped.message.includes("Failed to test operation for task 'some-id'"));
            assert.ok(mapped.message.includes("Unexpected failure"));
        });
    });
});
