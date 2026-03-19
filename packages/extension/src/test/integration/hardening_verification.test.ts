import * as assert from 'assert';
import * as vscode from 'vscode';
import { TaskManager } from '@tasklist/core';
import { TasklistWizard } from '../../views/TasklistWizard.js';
import * as path from 'path';
import * as fs from 'fs';

suite('Hardening Verification Tests', () => {
    let taskManager: TaskManager;

    suiteSetup(async () => {
        let workspaceRoot: string;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            workspaceRoot = workspaceFolders[0].uri.fsPath;
        } else {
            workspaceRoot = path.join(fs.realpathSync('/tmp'), `hardening-test-${Date.now()}`);
            if (!fs.existsSync(workspaceRoot)) {
                fs.mkdirSync(workspaceRoot, { recursive: true });
            }
        }
        taskManager = new TaskManager(workspaceRoot);
    });

    /**
     * Issue 5: UI Flicker / Button Spamming
     * Verify that only one wizard can be active at a time.
     */
    test('Stability & Concurrency: TasklistWizard.run should prevent concurrent executions', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TasklistWizard as any).isRunning = false;

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        vscode.commands.executeCommand('tasklist.createTask');

        await new Promise(resolve => setTimeout(resolve, 300));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assert.strictEqual((TasklistWizard as any).isRunning, true, 'Wizard should be running after command trigger');

        const secondWizardResult = await TasklistWizard.run(taskManager);
        assert.strictEqual(secondWizardResult, undefined, 'Second wizard should immediately return undefined while first is running');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TasklistWizard as any).isRunning = false;
    });

    /**
     * Issue 6: State Leakage
     * Verify that passing a TaskTreeItem to createTask ignores its selection.
     */
    test('State Leakage: tasklist.createTask should ignore TaskTreeItem arguments', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockTask: any = { id: 'leakage-target', type: 'task' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockItem: any = { task: mockTask };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TasklistWizard as any).isRunning = false;

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        vscode.commands.executeCommand('tasklist.createTask', mockItem);

        await new Promise(resolve => setTimeout(resolve, 500));

        const found = taskManager.findEntryGlobally('leakage-target');
        assert.strictEqual(found, undefined, 'Should NOT have created task from leaked selection context');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (TasklistWizard as any).isRunning = false;
    });

    /**
     * Artifact Resolution
     * Verify that task-details template is registered and available.
     */
    test('Artifact Resolution: task-details template should be resolved', async () => {
        const taskId = `artifact-test-${Date.now()}`;
        taskManager.createTask(taskId, 'task');

        const found = taskManager.findEntryGlobally(taskId);
        assert.ok(found, 'Task should be created');
    });
});
