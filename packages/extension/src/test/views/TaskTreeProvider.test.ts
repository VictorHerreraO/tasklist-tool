import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { TaskManager, ArtifactRegistry, ArtifactService } from '@tasklist/core';
import { TaskTreeProvider, TaskTreeItem, ArtifactTreeItem } from '../../views/TaskTreeProvider';

suite('TaskTreeProvider Logic', () => {
    let workspaceRoot: string;
    let manager: TaskManager;
    let provider: TaskTreeProvider;
    let artifactService: ArtifactService;
    let registry: ArtifactRegistry;

    setup(async () => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-provider-test-'));
        manager = new TaskManager(workspaceRoot);
        
        const extensionRoot = path.join(workspaceRoot, 'ext-root');
        const templateDir = path.join(extensionRoot, 'templates');
        fs.mkdirSync(templateDir, { recursive: true });
        fs.writeFileSync(path.join(templateDir, 'task-details.ai.md'), `---
id: task-details
displayName: Task Details
description: Technical details and context for a task.
filename: task-details.ai.md
---
# Task Details

Template`);
        
        registry = new ArtifactRegistry(extensionRoot, workspaceRoot);
        registry.initialize();
        artifactService = new ArtifactService(workspaceRoot, manager, registry);
        
        provider = new TaskTreeProvider(manager, artifactService);
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
        assert.ok(parentItem instanceof TaskTreeItem);
        assert.strictEqual(parentItem.task.id, 'my-project');
        assert.strictEqual(parentItem.task.type, 'project');
    });

    test('getItemForId returns the correct item', async () => {
        manager.createTask('target-task');
        const item = await provider.getItemForId('target-task');

        assert.ok(item, 'Item should be found');
        assert.ok(item instanceof TaskTreeItem);
        assert.strictEqual(item.task.id, 'target-task');
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

            // Refinement: label should be clean now
            assert.strictEqual(item.label, 'active-task');
            assert.strictEqual(item.description, 'open • Active');
        });

        test('active task has :active suffix in contextValue', () => {
            const entry = manager.createTask('active-task');
            const item = new TaskTreeItem(entry, true);
            assert.strictEqual(item.id, 'root::active-task::task');
            assert.strictEqual(item.contextValue, 'task:open:active');
        });

        test('closed task has pass icon', () => {
            manager.createTask('closed-task');
            manager.start_task('closed-task');
            const entry = manager.close_task('closed-task');
            const item = new TaskTreeItem(entry);
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.strictEqual(icon.id, 'pass');
        });

        test('in-progress task has loading~spin icon', () => {
            manager.createTask('ip-task');
            const entry = manager.start_task('ip-task');
            const item = new TaskTreeItem(entry);
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.strictEqual(icon.id, 'loading~spin');
        });

        test('active items use progressBar.background color', () => {
            const entry = manager.createTask('active-item');
            const item = new TaskTreeItem(entry, true);
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.ok(icon.color, 'Active icon should have a color');
            assert.strictEqual((icon.color as vscode.ThemeColor).id, 'progressBar.background');
        });

        test('active in-progress task has unified loading~spin icon with color', () => {
            manager.createTask('active-ip');
            manager.start_task('active-ip');
            manager.activateTask('active-ip');
            const entry = manager.listTasks().find(t => t.id === 'active-ip')!;
            const item = new TaskTreeItem(entry, true);
            const icon = item.iconPath as vscode.ThemeIcon;
            
            // Refinement: no longer uses 'star-full'
            assert.strictEqual(icon.id, 'loading~spin');
            assert.strictEqual((icon.color as vscode.ThemeColor).id, 'progressBar.background');
        });

        test('active open task has unified circle icon with color', () => {
            manager.createTask('active-open');
            manager.activateTask('active-open');
            const entry = manager.listTasks().find(t => t.id === 'active-open')!;
            const item = new TaskTreeItem(entry, true);
            const icon = item.iconPath as vscode.ThemeIcon;
            
            // Refinement: no longer uses 'star'
            assert.strictEqual(icon.id, 'circle-large-outline');
            assert.strictEqual((icon.color as vscode.ThemeColor).id, 'progressBar.background');
        });

        test('project has folder icon when collapsed', () => {
            const entry = manager.createTask('my-proj', 'project');
            const item = new TaskTreeItem(entry);
            item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            item.updateIcon();
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.strictEqual(icon.id, 'folder');
        });

        test('project has folder-opened icon when expanded', () => {
            const entry = manager.createTask('my-proj', 'project');
            const item = new TaskTreeItem(entry);
            item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            item.updateIcon();
            const icon = item.iconPath as vscode.ThemeIcon;
            assert.strictEqual(icon.id, 'folder-opened');
        });

        test('active project has unified folder icon with color', () => {
            manager.createTask('active-proj', 'project');
            manager.activateTask('active-proj');
            const entry = manager.listTasks().find(t => t.id === 'active-proj')!;
            const item = new TaskTreeItem(entry, true);
            item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            item.updateIcon();
            const icon = item.iconPath as vscode.ThemeIcon;
            
            // Refinement: no longer uses 'root-folder'
            assert.strictEqual(icon.id, 'folder');
            assert.strictEqual((icon.color as vscode.ThemeColor).id, 'progressBar.background');
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

    suite('TaskTreeProvider Sorting', () => {
        test('sortTasks puts projects before tasks', async () => {
            manager.createTask('z-task', 'task');
            manager.createTask('a-proj', 'project');

            const children = await provider.getChildren();
            assert.ok(children[0] instanceof TaskTreeItem);
            assert.ok(children[1] instanceof TaskTreeItem);
            assert.strictEqual((children[0] as TaskTreeItem).task.id, 'a-proj');
            assert.strictEqual((children[1] as TaskTreeItem).task.id, 'z-task');
        });

        test('sortTasks uses natural numeric sorting for IDs', async () => {
            manager.createTask('task-10', 'task');
            manager.createTask('task-2', 'task');
            manager.createTask('task-1', 'task');

            const children = await provider.getChildren();
            assert.ok(children[0] instanceof TaskTreeItem);
            assert.ok(children[1] instanceof TaskTreeItem);
            assert.ok(children[2] instanceof TaskTreeItem);
            assert.strictEqual((children[0] as TaskTreeItem).task.id, 'task-1');
            assert.strictEqual((children[1] as TaskTreeItem).task.id, 'task-2');
            assert.strictEqual((children[2] as TaskTreeItem).task.id, 'task-10');
        });
    });

    suite('Artifact Resolution & Stability', () => {
        test('Task without artifacts is expandable by default', async () => {
            manager.createTask('no-artifacts');
            const item = await provider.getItemForId('no-artifacts');
            // Tasks are now always expandable for consistency
            assert.strictEqual(item?.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
        });

        test('Task with artifacts becomes expandable', async () => {
            manager.createTask('with-artifacts');
            artifactService.updateArtifact('with-artifacts', 'task-details', '# Details');
            
            const item = await provider.getItemForId('with-artifacts');
            assert.strictEqual(item?.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
        });

        test('getChildren returns artifacts for a task', async () => {
            manager.createTask('task-1');
            artifactService.updateArtifact('task-1', 'task-details', '# Details');
            
            const taskItem = await provider.getItemForId('task-1');
            const children = await provider.getChildren(taskItem);
            
            const artifacts = children.filter(c => c instanceof ArtifactTreeItem);
            assert.strictEqual(artifacts.length, 1);
            assert.strictEqual((artifacts[0] as ArtifactTreeItem).label, 'Task Details');
        });

        test('Artifacts have correct stable composite IDs', async () => {
            manager.createTask('task-1');
            artifactService.updateArtifact('task-1', 'task-details', '# Details');
            
            const taskItem = await provider.getItemForId('task-1');
            const children = await provider.getChildren(taskItem);
            const artifact = children.find(c => c instanceof ArtifactTreeItem) as ArtifactTreeItem;
            
            assert.strictEqual(artifact.id, 'task-1::task-details::artifact');
        });

        test('Artifacts have correct descriptions based on parent type', async () => {
            manager.createTask('proj-1', 'project');
            manager.createTask('task-1', 'task');
            artifactService.updateArtifact('proj-1', 'task-details', '# Proj');
            artifactService.updateArtifact('task-1', 'task-details', '# Task');

            const projItem = await provider.getItemForId('proj-1');
            const taskItem = await provider.getItemForId('task-1');

            const projChildren = await provider.getChildren(projItem);
            const taskChildren = await provider.getChildren(taskItem);

            const projArtifact = projChildren.find(c => c instanceof ArtifactTreeItem) as ArtifactTreeItem;
            const taskArtifact = taskChildren.find(c => c instanceof ArtifactTreeItem) as ArtifactTreeItem;

            assert.strictEqual(projArtifact.description, 'Project');
            assert.strictEqual(taskArtifact.description, undefined);
        });

        test('Mixed children: subtasks come before artifacts', async () => {
            manager.createTask('proj', 'project');
            manager.createTask('sub-1', 'task', 'proj');
            artifactService.updateArtifact('proj', 'task-details', '# Details');
            
            const projItem = await provider.getItemForId('proj');
            const children = await provider.getChildren(projItem);
            
            assert.strictEqual(children.length, 2);
            assert.ok(children[0] instanceof TaskTreeItem, 'First child should be a task');
            assert.ok(children[1] instanceof ArtifactTreeItem, 'Second child should be an artifact');
        });
    });
});
