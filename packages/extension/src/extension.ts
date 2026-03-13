import * as vscode from 'vscode';
import { TaskManager, ArtifactRegistry, ArtifactService, TaskEventType } from '@tasklist/core';
import { ListTasksTool } from './tools/listTasksTool.js';
import { CreateTaskTool } from './tools/createTaskTool.js';
import { ActivateTaskTool } from './tools/activateTaskTool.js';
import { DeactivateTaskTool } from './tools/deactivateTaskTool.js';
import { StartTaskTool } from './tools/startTaskTool.js';
import { CloseTaskTool } from './tools/closeTaskTool.js';
import { ListArtifactTypesTool } from './tools/listArtifactTypesTool.js';
import { ListArtifactsTool } from './tools/listArtifactsTool.js';
import { GetArtifactTool } from './tools/getArtifactTool.js';
import { UpdateArtifactTool } from './tools/updateArtifactTool.js';
import { RegisterArtifactTypeTool } from './tools/registerArtifactTypeTool.js';
import { PromoteToProjectTool } from './tools/promoteToProjectTool.js';
import { TaskTreeProvider, TaskTreeItem } from './views/TaskTreeProvider.js';

/**
 * Activates the extension.
 *
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('Tasklist Tool: Activating...');

    try {
        // 1. Immediate UI Registration
        const treeProvider = new TaskTreeProvider();
        const treeView = vscode.window.createTreeView('tasklist-tree', {
            treeDataProvider: treeProvider,
            showCollapseAll: true
        });
        context.subscriptions.push(treeView);
        console.log('Tasklist Tool: TreeView "tasklist-tree" registered.');

        // 2. Guard Checks
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.warn('Tasklist Tool: No workspace folders found.');
            vscode.window.showErrorMessage(
                'Tasklist Tool requires an open workspace folder. Please open a folder and try again.'
            );
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const extensionRoot = context.extensionUri.fsPath;

        // 3. Service Initialization
        console.log('Tasklist Tool: Initializing services...');
        const taskManager = new TaskManager(workspaceRoot);
        const registry = new ArtifactRegistry(extensionRoot, workspaceRoot);

        // Connect provider to initialized task manager
        treeProvider.setTaskManager(taskManager);

        // Subscribe to task updates and refresh the tree view
        const taskUpdateSubscription = taskManager.onDidUpdateTask(async (data) => {
            treeProvider.refresh();

            // Auto-reveal active task
            if (data.event === TaskEventType.Activated) {
                // Focus the active task in the tree
                const item = await treeProvider.getItemForId(data.taskId);
                if (item) {
                    // Use a small delay to allow the tree to refresh before revealing
                    // This ensures the item exists in the tree's internal model if it was just created/moved
                    setTimeout(() => {
                        treeView.reveal(item, {
                            select: true,
                            focus: true,
                            expand: true
                        });
                    }, 100);
                }
            }
        });
        context.subscriptions.push({ dispose: taskUpdateSubscription });

        await registry.initialize();
        const artifactService = new ArtifactService(workspaceRoot, taskManager, registry);

        // 4. Tool Registration
        context.subscriptions.push(
            vscode.lm.registerTool('list_tasks', new ListTasksTool(taskManager)),
            vscode.lm.registerTool('create_task', new CreateTaskTool(taskManager)),
            vscode.lm.registerTool('activate_task', new ActivateTaskTool(taskManager)),
            vscode.lm.registerTool('deactivate_task', new DeactivateTaskTool(taskManager)),
            vscode.lm.registerTool('start_task', new StartTaskTool(taskManager)),
            vscode.lm.registerTool('close_task', new CloseTaskTool(taskManager)),
            vscode.lm.registerTool('promote_to_project', new PromoteToProjectTool(taskManager)),
            vscode.lm.registerTool('list_artifact_types', new ListArtifactTypesTool(registry)),
            vscode.lm.registerTool('list_artifacts', new ListArtifactsTool(taskManager, artifactService)),
            vscode.lm.registerTool('get_artifact', new GetArtifactTool(taskManager, artifactService)),
            vscode.lm.registerTool('update_artifact', new UpdateArtifactTool(taskManager, artifactService)),
            vscode.lm.registerTool('register_artifact_type', new RegisterArtifactTypeTool(workspaceRoot, registry)),
        );

        // 5. Tree View Command Handlers
        context.subscriptions.push(
            vscode.commands.registerCommand('tasklist.refresh', () => {
                treeProvider.refresh();
            }),
            vscode.commands.registerCommand('tasklist.startTask', async (node: TaskTreeItem) => {
                try {
                    await taskManager.start_task(node.task.id);
                    // Tree will refresh automatically via onDidUpdateTask listener
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to start task: ${error instanceof Error ? error.message : String(error)}`);
                }
            }),
            vscode.commands.registerCommand('tasklist.closeTask', async (node: TaskTreeItem) => {
                try {
                    await taskManager.close_task(node.task.id);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to close task: ${error instanceof Error ? error.message : String(error)}`);
                }
            }),
            vscode.commands.registerCommand('tasklist.promoteTask', async (node: TaskTreeItem) => {
                try {
                    await taskManager.promoteTaskToProject(node.task.id);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to promote task to project: ${error instanceof Error ? error.message : String(error)}`);
                }
            }),
            vscode.commands.registerCommand('tasklist.openTaskDetails', async (node: TaskTreeItem) => {
                try {
                    const taskId = node.task.id;
                    const artifacts = artifactService.listArtifacts(taskId);
                    const detailsArtifact = artifacts.find(a => a.type.id === 'task-details');

                    if (detailsArtifact?.exists) {
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(detailsArtifact.path));
                        await vscode.window.showTextDocument(doc);
                    } else {
                        const selection = await vscode.window.showInformationMessage(
                            `Task details for '${taskId}' do not exist. Would you like to create them from the template?`,
                            'Create',
                            'Cancel'
                        );

                        if (selection === 'Create') {
                            const content = artifactService.getArtifact(taskId, 'task-details');
                            artifactService.updateArtifact(taskId, 'task-details', content);
                            // Refresh and open
                            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(detailsArtifact!.path));
                            await vscode.window.showTextDocument(doc);
                        }
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to open task details: ${error instanceof Error ? error.message : String(error)}`);
                }
            })
        );

        console.log('Tasklist Tool: Extension is now fully active.');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Tasklist Tool: Activation failed:', error);
        vscode.window.showErrorMessage(`Tasklist Tool activation failed: ${message}`);
        throw error;
    }
}

/**
 * Deactivates the extension.
 */
export function deactivate() {
    // Extension deactivation logic.
}
