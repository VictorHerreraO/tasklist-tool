import * as assert from 'assert';
import * as vscode from 'vscode';
import { TaskManager } from '@tasklist/core';
import * as path from 'path';
import * as fs from 'fs';

suite('Wizard Validation Tests', () => {
    let taskManager: TaskManager;
    let workspaceRoot: string;

    suiteSetup(async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            workspaceRoot = workspaceFolders[0].uri.fsPath;
        } else {
            workspaceRoot = path.join(fs.realpathSync('/tmp'), `tasklist-test-${Date.now()}`);
            if (!fs.existsSync(workspaceRoot)) {
                fs.mkdirSync(workspaceRoot, { recursive: true });
            }
        }
        taskManager = new TaskManager(workspaceRoot);
    });

    test('findEntryGlobally should find a root task', async () => {
        const taskId = `root-task-${Date.now()}`;
        taskManager.createTask(taskId, 'task');

        const found = taskManager.findEntryGlobally(taskId);
        assert.ok(found, 'Should find root task');
        assert.strictEqual(found.entry.id, taskId);
    });

    test('findEntryGlobally should find a root task but not nested tasks without parentId', async () => {
        const rootId = `root-task-${Date.now()}`;
        const projectId = `proj-${Date.now()}`;
        const nestedId = `nested-task-${Date.now()}`;

        taskManager.createTask(rootId, 'task');
        taskManager.createTask(projectId, 'project');
        taskManager.createTask(nestedId, 'task', projectId);

        assert.ok(taskManager.findEntryGlobally(rootId), 'Should find root task');
        assert.strictEqual(taskManager.findEntryGlobally(nestedId), undefined, 'Should NOT find nested task when searching from root index');
        assert.ok(taskManager.findEntryGlobally(nestedId, projectId), 'Should find nested task when parentTaskId is provided');
    });

    test('createTask should allow same ID in different projects', () => {
        const id = `common-id-${Date.now()}`;
        const projA = `proj-a-${Date.now()}`;
        const projB = `proj-b-${Date.now()}`;

        taskManager.createTask(projA, 'project');
        taskManager.createTask(projB, 'project');

        // Create in Proj A
        taskManager.createTask(id, 'task', projA);

        // Create in Proj B (should pass because it is a different scope)
        assert.doesNotThrow(() => {
            taskManager.createTask(id, 'task', projB);
        });

        // Create in Proj A again (should fail)
        assert.throws(() => {
            taskManager.createTask(id, 'task', projA);
        }, /already exists in project/);
    });

    test('findEntryGlobally should return undefined for non-existent task', () => {
        const found = taskManager.findEntryGlobally('non-existent-' + Date.now());
        assert.strictEqual(found, undefined, 'Should not find non-existent task');
    });
});
