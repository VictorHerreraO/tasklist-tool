import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Registration Contract Tests', () => {
    
    test('All commands from package.json should be registered', async () => {
        const expectedCommands = [
            'tasklist.activateTask',
            'tasklist.addSubtask',
            'tasklist.refresh',
            'tasklist.startTask',
            'tasklist.closeTask',
            'tasklist.promoteTask',
            'tasklist.createTask'
        ];

        const allCommands = await vscode.commands.getCommands(true);
        for (const cmd of expectedCommands) {
            assert.ok(allCommands.includes(cmd), `Command '${cmd}' is not registered`);
        }
    });

    test('All language model tools from package.json should be registered', async () => {
        const expectedTools = [
            'list_tasks',
            'create_task',
            'activate_task',
            'deactivate_task',
            'start_task',
            'close_task',
            'list_artifact_types',
            'list_artifacts',
            'get_artifact',
            'update_artifact',
            'register_artifact_type',
            'promote_to_project'
        ];

        // vscode.lm.tools is the API to get registered tools
        // We need to wait a bit to ensure services are initialized if needed,
        // but activation should have happened by now.
        const registeredTools = vscode.lm.tools;
        const registeredToolNames = registeredTools.map(t => t.name);

        for (const tool of expectedTools) {
            assert.ok(registeredToolNames.includes(tool), `Tool '${tool}' is not registered. Registered: ${registeredToolNames.join(', ')}`);
        }
    });
});
