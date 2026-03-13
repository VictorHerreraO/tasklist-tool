import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArtifactRegistry } from '../services/artifactRegistry.js';

function makeTmpDir(prefix: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeTmpDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

describe('ArtifactRegistry', () => {
    let extensionRoot: string;
    let workspaceRoot: string;
    let registry: ArtifactRegistry;

    beforeEach(() => {
        extensionRoot = makeTmpDir('extension-root-');
        workspaceRoot = makeTmpDir('workspace-root-');
        registry = new ArtifactRegistry(extensionRoot, workspaceRoot);
    });

    afterEach(() => {
        removeTmpDir(extensionRoot);
        removeTmpDir(workspaceRoot);
    });

    it('resolves built-in templates from {extensionRoot}/templates', () => {
        const templatesDir = path.join(extensionRoot, 'templates');
        fs.mkdirSync(templatesDir, { recursive: true });

        const templateContent = '---\nid: test-type\ndisplayName: Test\ndescription: Test Desc\nfilename: test.md\n---\nBody';
        fs.writeFileSync(path.join(templatesDir, 'test.ai.md'), templateContent);

        registry.initialize();
        const type = registry.getType('test-type');
        assert.strictEqual(type.displayName, 'Test');
    });

    it('resolves built-in templates from {extensionRoot}/src/templates (development fallback)', () => {
        const templatesDir = path.join(extensionRoot, 'src', 'templates');
        fs.mkdirSync(templatesDir, { recursive: true });

        const templateContent = '---\nid: dev-type\ndisplayName: Dev\ndescription: Dev Desc\nfilename: dev.md\n---\nBody';
        fs.writeFileSync(path.join(templatesDir, 'dev.ai.md'), templateContent);

        registry.initialize();
        const type = registry.getType('dev-type');
        assert.strictEqual(type.displayName, 'Dev');
    });

    it('resolves built-in templates from {extensionRoot}/out/templates (compiled dependency fallback)', () => {
        const templatesDir = path.join(extensionRoot, 'out', 'templates');
        fs.mkdirSync(templatesDir, { recursive: true });

        const templateContent = '---\nid: out-type\ndisplayName: Out\ndescription: Out Desc\nfilename: out.md\n---\nBody';
        fs.writeFileSync(path.join(templatesDir, 'out.ai.md'), templateContent);

        registry.initialize();
        const type = registry.getType('out-type');
        assert.strictEqual(type.displayName, 'Out');
    });

    it('workspace templates override built-in templates', () => {
        // Setup built-in
        const builtInDir = path.join(extensionRoot, 'templates');
        fs.mkdirSync(builtInDir, { recursive: true });
        fs.writeFileSync(path.join(builtInDir, 'common.ai.md'), '---\nid: common\ndisplayName: Built-in\ndescription: D\nfilename: f.md\n---\nB');

        // Setup workspace override
        const workspaceDir = path.join(workspaceRoot, '.tasks', 'templates');
        fs.mkdirSync(workspaceDir, { recursive: true });
        fs.writeFileSync(path.join(workspaceDir, 'common.ai.md'), '---\nid: common\ndisplayName: Workspace\ndescription: D\nfilename: f.md\n---\nB');

        registry.initialize();
        const type = registry.getType('common');
        assert.strictEqual(type.displayName, 'Workspace');
    });

    it('gracefully handles missing directories during initialization', () => {
        // No directories created
        assert.doesNotThrow(() => registry.initialize());
        assert.strictEqual(registry.getTypes().length, 0);
    });
});
