import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager, TaskStatus } from '@tasklist/core';
import { TaskTreeProvider, TaskTreeItem } from '../../views/TaskTreeProvider';

// Mock vscode as needed or rely on the fact that we are testing logic
// Since we are running in a node environment for unit tests, we might need a mock for vscode
// But TaskTreeItem extends vscode.TreeItem, which might throw if vscode is not defined.
// However, typically vscode-test-cli handles the environment.

suite('TaskTreeProvider Logic', () => {
    let workspaceRoot: string;
    let manager: TaskManager;
    let provider: TaskTreeProvider;

    setup(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-provider-test-'));
        manager = new TaskManager(workspaceRoot);
        provider = new TaskTreeProvider(manager);
    });

    teardown(() => {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    });

    test('getParent returns undefined for top-level tasks', async () => {
        const entry = manager.createTask('top-level');
        const item = new TaskTreeItem(entry);
        const parent = await provider.getParent(item);
        assert.strictEqual(parent, undefined);
    });

    test('getParent returns the correct project item for subtasks', async () => {
        const project = manager.createTask('my-project', 'project');
        const subtask = manager.createTask('my-subtask', 'task', 'my-project');

        const subItem = new TaskTreeItem(subtask);
        const parentItem = await provider.getParent(subItem);

        assert.ok(parentItem, 'Parent should be found');
        assert.strictEqual(parentItem!.task.id, 'my-project');
        assert.strictEqual(parentItem!.task.type, 'project');
    });

    test('getItemForId returns the correct item', async () => {
        manager.createTask('target-task');
        const item = await provider.getItemForId('target-task');

        assert.ok(item, 'Item should be found');
        assert.strictEqual(item!.task.id, 'target-task');
    });
});
