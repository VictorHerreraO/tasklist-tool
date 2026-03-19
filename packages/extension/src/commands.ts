import * as vscode from 'vscode';
import { TaskManager, ArtifactService } from '@tasklist/core';
import { TaskTreeProvider, TaskTreeItem, ArtifactTreeItem } from './views/TaskTreeProvider.js';
import { TasklistWizard } from './views/TasklistWizard.js';

/**
 * Registers all VS Code commands for the tasklist extension.
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    treeProvider: TaskTreeProvider,
    treeView: vscode.TreeView<TaskTreeItem | ArtifactTreeItem>,
    outputChannel: vscode.OutputChannel,
    getTaskManager: () => TaskManager | undefined,
    getArtifactService: () => ArtifactService | undefined
): void {

    const getSelectedNode = (node: TaskTreeItem | ArtifactTreeItem | undefined): TaskTreeItem | ArtifactTreeItem | undefined => {
        if (node) {
            return node;
        }
        if (treeView.selection && treeView.selection.length > 0) {
            return treeView.selection[0];
        }
        return undefined;
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('tasklist.activateTask', async (node: TaskTreeItem | ArtifactTreeItem) => {
            const taskManager = getTaskManager();
            if (!taskManager) {
                return;
            }

            const target = getSelectedNode(node);
            if (!target || !(target instanceof TaskTreeItem)) {
                vscode.window.showWarningMessage("No task or project selected in the Sidebar.");
                return;
            }
            try {
                await taskManager.activateTask(target.task.id, target.task.parentTaskId);
            } catch (error) {
                const msg = `Failed to activate task: ${error instanceof Error ? error.message : String(error)}`;
                outputChannel.appendLine(msg);
                vscode.window.showErrorMessage(msg);
            }
        }),

        vscode.commands.registerCommand('tasklist.refresh', () => {
            treeProvider.refresh();
        }),

        vscode.commands.registerCommand('tasklist.startTask', async (node: TaskTreeItem | ArtifactTreeItem) => {
            const taskManager = getTaskManager();
            if (!taskManager) {
                return;
            }

            const target = getSelectedNode(node);
            if (!target || !(target instanceof TaskTreeItem)) {
                vscode.window.showWarningMessage("No task or project selected in the Sidebar.");
                return;
            }
            try {
                await taskManager.start_task(target.task.id, target.task.parentTaskId);
            } catch (error) {
                const msg = `Failed to start task: ${error instanceof Error ? error.message : String(error)}`;
                outputChannel.appendLine(msg);
                vscode.window.showErrorMessage(msg);
            }
        }),

        vscode.commands.registerCommand('tasklist.closeTask', async (node: TaskTreeItem | ArtifactTreeItem) => {
            const taskManager = getTaskManager();
            if (!taskManager) {
                return;
            }

            const target = getSelectedNode(node);
            if (!target || !(target instanceof TaskTreeItem)) {
                vscode.window.showWarningMessage("No task or project selected in the Sidebar.");
                return;
            }
            try {
                await taskManager.close_task(target.task.id, target.task.parentTaskId);
            } catch (error) {
                const msg = `Failed to close task: ${error instanceof Error ? error.message : String(error)}`;
                outputChannel.appendLine(msg);
                vscode.window.showErrorMessage(msg);
            }
        }),

        vscode.commands.registerCommand('tasklist.promoteTask', async (node: TaskTreeItem | ArtifactTreeItem) => {
            const taskManager = getTaskManager();
            if (!taskManager) {
                return;
            }

            const target = getSelectedNode(node);
            if (!target || !(target instanceof TaskTreeItem)) {
                vscode.window.showWarningMessage("No task or project selected in the Sidebar.");
                return;
            }
            try {
                await taskManager.promoteTaskToProject(target.task.id);
            } catch (error) {
                const msg = `Failed to promote task to project: ${error instanceof Error ? error.message : String(error)}`;
                outputChannel.appendLine(msg);
                vscode.window.showErrorMessage(msg);
            }
        }),

        vscode.commands.registerCommand('tasklist.addSubtask', async (node: TaskTreeItem | ArtifactTreeItem) => {
            const taskManager = getTaskManager();
            if (!taskManager) {
                return;
            }

            const target = getSelectedNode(node);
            if (!target || !(target instanceof TaskTreeItem)) {
                vscode.window.showWarningMessage("No project selected in the Sidebar.");
                return;
            }
            if (target.task.type !== 'project') {
                vscode.window.showWarningMessage("Subtasks can only be added to projects.");
                return;
            }
            
            const result = await TasklistWizard.run(taskManager, target.task.id);
            if (result) {
                setTimeout(async () => {
                    const item = await treeProvider.getItemForId(result.id, result.parentTaskId);
                    if (item) {
                        treeView.reveal(item, { select: true, focus: true, expand: true });
                    }
                }, 200);
            }
        }),

        vscode.commands.registerCommand('tasklist.createTask', async (args?: unknown) => {
            const taskManager = getTaskManager();
            if (args instanceof TaskTreeItem || args instanceof ArtifactTreeItem || (args && typeof args === 'object' && 'task' in args)) {
                args = undefined;
            }

            const normalizedArgs = (Array.isArray(args) ? args[0] : args) as {
                id?: string;
                type?: 'task' | 'project';
                parentTaskId?: string;
            } | undefined;

            const taskId = normalizedArgs?.id;
            const type = normalizedArgs?.type || 'task';
            const parentTaskId = normalizedArgs?.parentTaskId;

            if (!taskId) {
                if (taskManager) {
                    const result = await TasklistWizard.run(taskManager, parentTaskId);
                    if (result) {
                        setTimeout(async () => {
                            const item = await treeProvider.getItemForId(result.id, result.parentTaskId);
                            if (item) {
                                treeView.reveal(item, { select: true, focus: true, expand: true });
                            }
                        }, 200);
                    }
                } else {
                    const msg = 'No active workspace. Task creation failed.';
                    outputChannel.appendLine(msg);
                    vscode.window.showErrorMessage(msg);
                }
                return;
            }

            try {
                if (taskManager) {
                    await taskManager.createTask(taskId, type as 'task' | 'project', parentTaskId);
                    vscode.window.showInformationMessage(`Task '${taskId}' created.`);
                } else {
                    const msg = 'No active workspace. Task creation failed.';
                    outputChannel.appendLine(msg);
                    vscode.window.showErrorMessage(msg);
                }
            } catch (error) {
                const msg = `Failed to create task: ${error instanceof Error ? error.message : String(error)}`;
                outputChannel.appendLine(msg);
                vscode.window.showErrorMessage(msg);
            }
        }),

        vscode.commands.registerCommand('tasklist.openTaskDetails', async (node: TaskTreeItem | ArtifactTreeItem | { id: string; parentTaskId?: string }) => {
            const artifactService = getArtifactService();
            const taskManager = getTaskManager();
            if (!artifactService || !taskManager) {
                outputChannel.appendLine('Artifact service not initialized. Please ensure a workspace is open.');
                vscode.window.showWarningMessage('Artifact service not initialized. Please ensure a workspace is open.');
                return;
            }

            let taskId: string | undefined;
            let parentTaskId: string | undefined;

            if (node instanceof TaskTreeItem) {
                taskId = node.task.id;
                parentTaskId = node.task.parentTaskId;
            } else if (node && typeof node === 'object' && 'id' in node) {
                taskId = node.id;
                parentTaskId = node.parentTaskId;
            } else {
                const target = getSelectedNode(node as TaskTreeItem | ArtifactTreeItem | undefined);
                if (target instanceof TaskTreeItem) {
                    taskId = target.task.id;
                    parentTaskId = target.task.parentTaskId;
                }
            }

            if (!taskId) {
                vscode.window.showWarningMessage("No task or project selected in the Sidebar.");
                return;
            }

            try {
                const artifacts = artifactService.listArtifacts(taskId, parentTaskId);
                const detailsArtifact = artifacts.find(a => a.type.id === 'task-details');

                if (detailsArtifact) {
                    if (!detailsArtifact.exists) {
                        const selection = await vscode.window.showInformationMessage(
                            `Task details for '${taskId}' do not exist. Would you like to create them from the template?`,
                            'Create',
                            'Cancel'
                        );

                        if (selection !== 'Create') {
                            return;
                        }

                        const content = artifactService.getArtifact(taskId, 'task-details', parentTaskId);
                        artifactService.updateArtifact(taskId, 'task-details', content, parentTaskId);
                        // Refresh tree to show the new artifact
                        treeProvider.refresh();
                    }
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(detailsArtifact.path));
                    await vscode.window.showTextDocument(doc);
                }
            } catch (error) {
                const msg = `Failed to open task details: ${error instanceof Error ? error.message : String(error)}`;
                outputChannel.appendLine(msg);
                vscode.window.showErrorMessage(msg);
            }
        })
    );
}
