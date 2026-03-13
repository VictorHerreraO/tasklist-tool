import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { TaskManager } from '@tasklist/core';
import { TaskTreeProvider, TaskTreeItem } from '../../views/TaskTreeProvider';

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
        manager.createTask('my-project', 'project');
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

    test('getItemForId returns undefined for non-existent taskId', async () => {
        const item = await provider.getItemForId('ghost-task');
        assert.strictEqual(item, undefined);
    });

    suite('TaskTreeItem Visual State', () => {
        test('active task has correct label and description', () => {
            const entry = manager.createTask('active-task');
            manager.activateTask('active-task');
            const item = new TaskTreeItem(entry, true);

            assert.strictEqual(item.label, 'active-task (active)');
            assert.strictEqual(item.description, 'open • Active');
        });

        test('active task has :active suffix in contextValue', () => {
            const entry = manager.createTask('active-task');
            const item = new TaskTreeItem(entry, true);
            assert.strictEqual(item.contextValue, 'task:open:active');
        });

        test('closed task has pass-filled icon', () => {
            manager.createTask('closed-task');
            manager.start_task('closed-task');
            const entry = manager.close_task('closed-task');
            const item = new TaskTreeItem(entry);
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.strictEqual(icon.id, 'pass-filled');
        });

        test('in-progress task has sync~spin icon', () => {
            manager.createTask('ip-task');
            const entry = manager.start_task('ip-task');
            const item = new TaskTreeItem(entry);
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.strictEqual(icon.id, 'sync~spin');
        });

        test('tooltip contains Markdown with task metadata', () => {
            const entry = manager.createTask('meta-task');
            const item = new TaskTreeItem(entry);
            const tooltip = item.tooltip as vscode.MarkdownString;
            assert.ok(tooltip.value.includes('### **Task:** meta-task'));
            assert.ok(tooltip.value.includes('**Status:** OPEN'));
            assert.ok(tooltip.value.includes('*Click to open details*'));
        });
    });
});
