import * as vscode from 'vscode';
import { TaskManager, ArtifactRegistry, ArtifactService } from '@tasklist/core';
import { ListTasksTool } from './listTasksTool.js';
import { CreateTaskTool } from './createTaskTool.js';
import { ActivateTaskTool } from './activateTaskTool.js';
import { DeactivateTaskTool } from './deactivateTaskTool.js';
import { StartTaskTool } from './startTaskTool.js';
import { CloseTaskTool } from './closeTaskTool.js';
import { ListArtifactTypesTool } from './listArtifactTypesTool.js';
import { ListArtifactsTool } from './listArtifactsTool.js';
import { GetArtifactTool } from './getArtifactTool.js';
import { UpdateArtifactTool } from './updateArtifactTool.js';
import { RegisterArtifactTypeTool } from './registerArtifactTypeTool.js';
import { PromoteToProjectTool } from './promoteToProjectTool.js';

/**
 * Registers all Language Model tools provided by the extension.
 */
export function registerTools(
    taskManager: TaskManager,
    registry: ArtifactRegistry,
    artifactService: ArtifactService,
    workspaceRoot: string
): vscode.Disposable[] {
    return [
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
    ];
}
