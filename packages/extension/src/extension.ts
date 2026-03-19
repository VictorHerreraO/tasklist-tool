import * as vscode from 'vscode';
import { TaskManager, ArtifactRegistry, ArtifactService, TaskEventType } from '@tasklist/core';
import { TaskTreeProvider } from './views/TaskTreeProvider.js';
import { registerViews } from './views/viewRegistry.js';
import { registerCommands } from './commands.js';
import { registerTools } from './tools/toolRegistry.js';

/**
 * Activates the extension.
 */
export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Tasklist Tool');
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine('Tasklist Tool: Activating...');

    let taskManager: TaskManager | undefined;
    let artifactService: ArtifactService | undefined;
    let serviceSubscriptions: vscode.Disposable[] = [];
    
    const treeProvider = new TaskTreeProvider();
    const treeView = registerViews(context, treeProvider);

    // Command Registration (Early)
    registerCommands(
        context,
        treeProvider,
        treeView,
        outputChannel,
        () => taskManager,
        () => artifactService
    );

    const initializeServices = async () => {
        try {
            // Clean up previous registrations to prevent duplicates on workspace folder changes
            for (const sub of serviceSubscriptions) {
                sub.dispose();
            }
            serviceSubscriptions = [];

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                taskManager = undefined;
                artifactService = undefined;
                treeProvider.setTaskManager(undefined);
                return;
            }

            outputChannel.appendLine('Tasklist Tool: Initializing services...');
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
                    const activeTask = taskManager?.getActiveTask();
                    const item = await treeProvider.getItemForId(data.taskId, activeTask?.parentTaskId);
                    if (item) {
                        setTimeout(() => {
                            treeView.reveal(item, { select: true, focus: true, expand: true });
                        }, 100);
                    }
                }
            });
            serviceSubscriptions.push({ dispose: taskUpdateSubscription });

            // Tool Registration
            const tools = registerTools(taskManager, registry, artifactService, workspaceRoot);
            serviceSubscriptions.push(...tools);

            outputChannel.appendLine('Tasklist Tool: Services initialized.');
        } catch (error) {
            const msg = `Tasklist Tool: Initialization failed: ${error instanceof Error ? error.stack || error.message : String(error)}`;
            outputChannel.appendLine(msg);
            vscode.window.showErrorMessage('Tasklist Tool failed to initialize. Check Output for details.');
        }
    };

    // Initial check
    await initializeServices();

    // Listen for workspace changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            outputChannel.appendLine('Tasklist Tool: Workspace folders changed, re-initializing...');
            await initializeServices();
        })
    );

    outputChannel.appendLine('Tasklist Tool: Extension activation complete.');
}

/**
 * Deactivates the extension.
 */
export function deactivate() {
    // Extension deactivation logic.
}
