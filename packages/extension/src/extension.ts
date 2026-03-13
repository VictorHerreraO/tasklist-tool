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

    let taskManager: TaskManager | undefined;
    let artifactService: ArtifactService | undefined;
    const treeProvider = new TaskTreeProvider();

    // 1. Immediate UI Registration
    const treeView = vscode.window.createTreeView('tasklist-tree', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // 2. Command Registration (Early)
    context.subscriptions.push(
        vscode.commands.registerCommand('tasklist.refresh', () => {
            treeProvider.refresh();
        }),
        vscode.commands.registerCommand('tasklist.startTask', async (node: TaskTreeItem) => {
            if (!taskManager) {
                return;
            }
            try {
                await taskManager.start_task(node.task.id);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start task: ${error instanceof Error ? error.message : String(error)}`);
            }
        }),
        vscode.commands.registerCommand('tasklist.closeTask', async (node: TaskTreeItem) => {
            if (!taskManager) {
                return;
            }
            try {
                await taskManager.close_task(node.task.id);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to close task: ${error instanceof Error ? error.message : String(error)}`);
            }
        }),
        vscode.commands.registerCommand('tasklist.promoteTask', async (node: TaskTreeItem) => {
            if (!taskManager) {
                return;
            }
            try {
                await taskManager.promoteTaskToProject(node.task.id);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to promote task to project: ${error instanceof Error ? error.message : String(error)}`);
            }
        }),
        vscode.commands.registerCommand('tasklist.createTask', async () => {
            const taskId = await vscode.window.showInputBox({
                prompt: 'Enter Task ID',
                placeHolder: 'e.g. feature-login'
            });
            if (taskId) {
                try {
                    if (taskManager) {
                        await taskManager.createTask(taskId);
                        vscode.window.showInformationMessage(`Task '${taskId}' created.`);
                    } else {
                        vscode.window.showErrorMessage('No active workspace. Task creation failed.');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }),
        vscode.commands.registerCommand('tasklist.openTaskDetails', async (node: TaskTreeItem) => {
            if (!artifactService || !taskManager) {
                vscode.window.showWarningMessage('Artifact service not initialized. Please ensure a workspace is open.');
                return;
            }
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

    // 3. Service Initialization Logic
    const initializeServices = async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            taskManager = undefined;
            artifactService = undefined;
            treeProvider.setTaskManager(undefined);
            return;
        }

        console.log('Tasklist Tool: Initializing services...');
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const extensionRoot = context.extensionUri.fsPath;

        taskManager = new TaskManager(workspaceRoot);
        const registry = new ArtifactRegistry(extensionRoot, workspaceRoot);
        await registry.initialize();
        artifactService = new ArtifactService(workspaceRoot, taskManager, registry);

        treeProvider.setTaskManager(taskManager);

        // Subscribe to task updates
        const taskUpdateSubscription = taskManager.onDidUpdateTask(async (data) => {
            treeProvider.refresh();
            if (data.event === TaskEventType.Activated) {
                const item = await treeProvider.getItemForId(data.taskId);
                if (item) {
                    setTimeout(() => {
                        treeView.reveal(item, { select: true, focus: true, expand: true });
                    }, 100);
                }
            }
        });
        context.subscriptions.push({ dispose: taskUpdateSubscription });

        // Tool Registration (only if workspace is open)
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

        console.log('Tasklist Tool: Services initialized.');
    };

    // Initial check
    await initializeServices();

    // Listen for workspace changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            console.log('Tasklist Tool: Workspace folders changed, re-initializing...');
            await initializeServices();
        })
    );

    console.log('Tasklist Tool: Extension activation complete.');
}

/**
 * Deactivates the extension.
 */
export function deactivate() {
    // Extension deactivation logic.
}
