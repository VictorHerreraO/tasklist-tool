import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Command Integration Tests', () => {
    test('tasklist.createTask with arguments creates a task', async () => {
        // Wait for workspace folders to be ready
        for (let i = 0; i < 50; i++) {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const taskId = `test-task-${Date.now()}`;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            assert.fail('No workspace folder open for tests');
        }
        const indexPath = path.join(workspaceFolders[0].uri.fsPath, '.tasks', 'index.json');

        // Execute command programmatically
        await vscode.commands.executeCommand('tasklist.createTask', { id: taskId });

        // Wait a bit for file system
        await new Promise(resolve => setTimeout(resolve, 500));

        assert.ok(fs.existsSync(indexPath), `Index file ${indexPath} should exist`);
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as { tasks: { id: string }[] };
        const task = index.tasks.find((t) => t.id === taskId);
        assert.ok(task, `Task ${taskId} should be in the index`);
    });

    test('tasklist.createTask with array arguments (URI style) creates a task', async () => {
        const taskId = `test-task-uri-${Date.now()}`;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            assert.fail('No workspace folder open for URI style test');
        }
        const indexPath = path.join(workspaceFolders[0].uri.fsPath, '.tasks', 'index.json');

        // Execute command as if from URI
        await vscode.commands.executeCommand('tasklist.createTask', [{ id: taskId }]);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Give it more time

        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as { tasks: { id: string }[] };
        const task = index.tasks.find((t) => t.id === taskId);
        assert.ok(task, `Task ${taskId} should be in the index (URI style)`);
    });

    test('tasklist.createTask with parentTaskId creates a nested task', async () => {
        const projectId = `test-project-${Date.now()}`;
        const taskId = `test-subtask-${Date.now()}`;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            assert.fail('No workspace folder open for nested task test');
        }

        const projectPath = path.join(workspaceFolders[0].uri.fsPath, '.tasks', projectId);

        // 1. Create project first
        await vscode.commands.executeCommand('tasklist.createTask', { id: projectId, type: 'project' });

        // 2. Create subtask
        await vscode.commands.executeCommand('tasklist.createTask', {
            id: taskId,
            parentTaskId: projectId
        });

        const subtaskIndexPath = path.join(workspaceFolders[0].uri.fsPath, '.tasks', projectId, 'index.json');
        await new Promise(resolve => setTimeout(resolve, 1000));

        assert.ok(fs.existsSync(subtaskIndexPath), `Nested index file ${subtaskIndexPath} should exist`);
        const index = JSON.parse(fs.readFileSync(subtaskIndexPath, 'utf-8')) as { tasks: { id: string }[] };
        const task = index.tasks.find((t) => t.id === taskId);
        assert.ok(task, `Subtask ${taskId} should be in the project index`);
    });
});
