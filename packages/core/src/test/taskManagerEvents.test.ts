import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager } from '../services/taskManager.js';
import { TaskEventType, TaskStatus } from '../models/task.js';

describe('TaskManager Events', () => {
    let workspaceRoot: string;
    let manager: TaskManager;

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-events-test-'));
        manager = new TaskManager(workspaceRoot);
    });

    afterEach(() => {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    });

    it('emits Created event when a task is created', (done) => {
        manager.onDidUpdateTask((data) => {
            if (data.event === TaskEventType.Created && data.taskId === 'test-task') {
                done();
            }
        });
        manager.createTask('test-task');
    });

    it('emits StatusChanged event when a task is started', (done) => {
        manager.createTask('start-task');
        manager.onDidUpdateTask((data) => {
            if (data.event === TaskEventType.StatusChanged && data.taskId === 'start-task') {
                done();
            }
        });
        manager.start_task('start-task');
    });

    it('emits StatusChanged event when a task is closed', (done) => {
        manager.createTask('close-task');
        manager.start_task('close-task');
        manager.onDidUpdateTask((data) => {
            if (data.event === TaskEventType.StatusChanged && data.taskId === 'close-task') {
                done();
            }
        });
        manager.close_task('close-task');
    });

    it('emits Activated event when a task is activated', (done) => {
        manager.createTask('active-task');
        manager.onDidUpdateTask((data) => {
            if (data.event === TaskEventType.Activated && data.taskId === 'active-task') {
                done();
            }
        });
        manager.activateTask('active-task');
    });

    it('emits Deactivated event when deactivateTask is called', (done) => {
        manager.onDidUpdateTask((data) => {
            if (data.event === TaskEventType.Deactivated) {
                done();
            }
        });
        manager.deactivateTask();
    });

    it('emits Updated event when a task is promoted to project', (done) => {
        manager.createTask('promote-task');
        manager.onDidUpdateTask((data) => {
            if (data.event === TaskEventType.Updated && data.taskId === 'promote-task') {
                done();
            }
        });
        manager.promoteTaskToProject('promote-task');
    });

    it('unregisters listener when returned function is called', () => {
        let callCount = 0;
        const dispose = manager.onDidUpdateTask(() => {
            callCount++;
        });

        manager.createTask('task-1');
        assert.strictEqual(callCount, 1);

        dispose();
        manager.createTask('task-2');
        assert.strictEqual(callCount, 1, 'Should not have called listener after disposal');
    });
});
