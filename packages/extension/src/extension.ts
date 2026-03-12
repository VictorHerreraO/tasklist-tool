import * as vscode from 'vscode';
import { TaskManager, ArtifactRegistry, ArtifactService } from '@tasklist/core';
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
import { TaskTreeProvider } from './views/TaskTreeProvider.js';

/**
 * Activates the extension.
 *
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
    // Require an open workspace folder.
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
            'Tasklist Tool requires an open workspace folder. Please open a folder and try again.'
        );
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const extensionRoot = context.extensionUri.fsPath;

    // Instantiate services (shared across all tool instances).
    const taskManager = new TaskManager(workspaceRoot);
    const registry = new ArtifactRegistry(extensionRoot, workspaceRoot);
    await registry.initialize();
    const artifactService = new ArtifactService(workspaceRoot, taskManager, registry);

    // Register Tree Provider
    const treeProvider = new TaskTreeProvider(taskManager);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('tasklist-tree', treeProvider)
    );

    // Register all 11 LM tools.
    context.subscriptions.push(
        vscode.lm.registerTool('list_tasks', new ListTasksTool(taskManager)),
        vscode.lm.registerTool('create_task', new CreateTaskTool(taskManager)),
        vscode.lm.registerTool('activate_task', new ActivateTaskTool(taskManager)),
        vscode.lm.registerTool('deactivate_task', new DeactivateTaskTool(taskManager)),
        vscode.lm.registerTool('start_task', new StartTaskTool(taskManager)),
        vscode.lm.registerTool('close_task', new CloseTaskTool(taskManager)),
        vscode.lm.registerTool('list_artifact_types', new ListArtifactTypesTool(registry)),
        vscode.lm.registerTool('list_artifacts', new ListArtifactsTool(taskManager, artifactService)),
        vscode.lm.registerTool('get_artifact', new GetArtifactTool(taskManager, artifactService)),
        vscode.lm.registerTool('update_artifact', new UpdateArtifactTool(taskManager, artifactService)),
        vscode.lm.registerTool('register_artifact_type', new RegisterArtifactTypeTool(workspaceRoot, registry)),
    );

    console.log('Tasklist Tool extension is now active.');
}

/**
 * Deactivates the extension.
 */
export function deactivate() {
    // Extension deactivation logic.
}
