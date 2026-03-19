import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Minimal interface for the package.json contribution structure.
 */
interface PackageJson {
    contributes?: {
        commands?: Array<{ command: string }>;
        languageModelTools?: Array<{ name: string }>;
    };
}

suite('Registration Contract Tests', () => {
    
    // Helper to read package.json
    const getPackageJson = (): PackageJson => {
        // In the test environment, __dirname points to out/test/
        // We need to go up to the extension root to find package.json
        const pkgPath = path.join(vscode.extensions.getExtension('local.tasklist-tool')?.extensionPath || '', 'package.json');
        const content = fs.readFileSync(pkgPath, 'utf8');
        return JSON.parse(content);
    };

    test('All commands from package.json should be registered', async () => {
        const pkg = getPackageJson();
        const expectedCommands = (pkg.contributes?.commands || []).map(c => c.command);

        assert.ok(expectedCommands.length > 0, 'No commands found in package.json to verify');

        // Small delay to ensure extension is fully activated
        await new Promise(resolve => setTimeout(resolve, 500));

        const allCommands = await vscode.commands.getCommands(true);
        for (const cmd of expectedCommands) {
            assert.ok(allCommands.includes(cmd), `Command '${cmd}' defined in package.json is not registered in the extension`);
        }
    });

    test('All language model tools from package.json should be registered', async () => {
        const pkg = getPackageJson();
        const expectedTools = (pkg.contributes?.languageModelTools || []).map(t => t.name);

        assert.ok(expectedTools.length > 0, 'No LM tools found in package.json to verify');

        const registeredTools = vscode.lm.tools;
        const registeredToolNames = registeredTools.map(t => t.name);

        for (const tool of expectedTools) {
            assert.ok(registeredToolNames.includes(tool), `Tool '${tool}' defined in package.json is not registered in the extension. Registered: ${registeredToolNames.join(', ')}`);
        }
    });
});
