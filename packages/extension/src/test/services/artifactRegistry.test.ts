import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArtifactRegistry, ArtifactType } from '@tasklist/core';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * At compiled test runtime, __dirname = <project>/out/test/services/
 * Walking three levels up gives the project root, where src/templates/ lives.
 */
const EXTENSION_ROOT = path.resolve(__dirname, '../../..');

const CUSTOM_TYPE: ArtifactType = {
    id: 'custom-notes',
    displayName: 'Custom Notes',
    description: 'A custom note type for testing.',
    filename: 'custom-notes.ai.md',
    templateBody: '# Custom Notes\n\n## Section\n\nContent goes here.\n',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-registry-test-'));
}

function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

suite('ArtifactRegistry', () => {
    let workspaceRoot: string;
    let registry: ArtifactRegistry;

    setup(() => {
        workspaceRoot = makeTmpWorkspace();
        registry = new ArtifactRegistry(EXTENSION_ROOT, workspaceRoot);
        registry.initialize();
    });

    teardown(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    // ── Default built-in types ─────────────────────────────────────────────

    suite('default built-in types', () => {
        test('loads exactly 5 default types after initialize()', () => {
            assert.strictEqual(registry.getTypes().length, 5);
        });

        test('includes all 5 expected built-in type IDs', () => {
            const ids = registry.getTypes().map(t => t.id);
            const expected = [
                'task-details',
                'research',
                'implementation-plan',
                'walkthrough',
                'review',
            ];
            for (const id of expected) {
                assert.ok(ids.includes(id), `Missing expected built-in type: '${id}'`);
            }
        });
    });

    // ── getType ────────────────────────────────────────────────────────────

    suite('getType', () => {
        test('returns the correct type for a known id', () => {
            const type = registry.getType('research');
            assert.strictEqual(type.id, 'research');
            assert.ok(type.displayName.length > 0, 'displayName should be populated');
        });

        test('throws with a descriptive message for an unknown id', () => {
            assert.throws(
                () => registry.getType('does-not-exist'),
                /Unknown artifact type 'does-not-exist'\./
            );
        });
    });

    // ── getFilename ────────────────────────────────────────────────────────

    suite('getFilename', () => {
        test('returns correct .ai.md filename for built-in types', () => {
            assert.strictEqual(registry.getFilename('research'), 'research.ai.md');
            assert.strictEqual(registry.getFilename('walkthrough'), 'walkthrough.ai.md');
            assert.strictEqual(registry.getFilename('review'), 'review.ai.md');
            assert.strictEqual(registry.getFilename('task-details'), 'task-details.ai.md');
            assert.strictEqual(registry.getFilename('implementation-plan'), 'implementation-plan.ai.md');
        });

        test('throws for an unknown type id', () => {
            assert.throws(
                () => registry.getFilename('unknown'),
                /Unknown artifact type 'unknown'\./
            );
        });
    });

    // ── getTemplate ────────────────────────────────────────────────────────

    suite('getTemplate', () => {
        test('returns a non-empty string for every built-in type', () => {
            for (const type of registry.getTypes()) {
                const body = registry.getTemplate(type.id);
                assert.ok(body.length > 0, `Template body should not be empty for '${type.id}'`);
            }
        });

        test('does NOT return YAML frontmatter — body must not start with ---', () => {
            for (const type of registry.getTypes()) {
                const body = registry.getTemplate(type.id);
                assert.ok(
                    !body.trimStart().startsWith('---'),
                    `Template for '${type.id}' must not contain YAML frontmatter`
                );
            }
        });

        test('template body contains Markdown headings (#)', () => {
            for (const type of registry.getTypes()) {
                const body = registry.getTemplate(type.id);
                assert.ok(
                    body.includes('#'),
                    `Template '${type.id}' should include at least one Markdown heading`
                );
            }
        });

        test('throws for an unknown type id', () => {
            assert.throws(
                () => registry.getTemplate('unknown'),
                /Unknown artifact type 'unknown'\./
            );
        });
    });

    // ── registerType (in-memory) ───────────────────────────────────────────

    suite('registerType (in-memory)', () => {
        test('makes new type available via getTypes()', () => {
            registry.registerType(CUSTOM_TYPE);
            const ids = registry.getTypes().map(t => t.id);
            assert.ok(ids.includes('custom-notes'), 'custom-notes should be in getTypes()');
        });

        test('makes new type retrievable via getType()', () => {
            registry.registerType(CUSTOM_TYPE);
            const type = registry.getType('custom-notes');
            assert.strictEqual(type.displayName, 'Custom Notes');
        });

        test('count increases by 1 after registering a new type', () => {
            const before = registry.getTypes().length;
            registry.registerType(CUSTOM_TYPE);
            assert.strictEqual(registry.getTypes().length, before + 1);
        });

        test('overrides an existing type when same id is re-registered', () => {
            const override: ArtifactType = { ...CUSTOM_TYPE, displayName: 'Overridden Name' };
            registry.registerType(CUSTOM_TYPE);
            registry.registerType(override);
            // Count should not increase again
            const ids = registry.getTypes().filter(t => t.id === 'custom-notes');
            assert.strictEqual(ids.length, 1);
            assert.strictEqual(ids[0].displayName, 'Overridden Name');
        });

        test('in-memory registration does NOT write any file to disk', () => {
            registry.registerType(CUSTOM_TYPE);
            const filePath = path.join(workspaceRoot, '.tasks', 'templates', 'custom-notes.ai.md');
            assert.strictEqual(fs.existsSync(filePath), false, 'No file should be written for in-memory registration');
        });
    });

    // ── registerAndPersistType ─────────────────────────────────────────────

    suite('registerAndPersistType', () => {
        test('writes a .ai.md file to .tasks/templates/', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            const filePath = path.join(workspaceRoot, '.tasks', 'templates', 'custom-notes.ai.md');
            assert.ok(fs.existsSync(filePath), 'Template file should exist on disk after persist');
        });

        test('written file starts with --- (has YAML frontmatter)', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            const filePath = path.join(workspaceRoot, '.talks', 'templates', 'custom-notes.ai.md');
            // Check via the templates dir path (correct path)
            const correctPath = path.join(workspaceRoot, '.tasks', 'templates', 'custom-notes.ai.md');
            const content = fs.readFileSync(correctPath, 'utf-8');
            assert.ok(content.startsWith('---'), 'Persisted file should begin with YAML frontmatter');
        });

        test('written file frontmatter contains the correct id field', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            const filePath = path.join(workspaceRoot, '.tasks', 'templates', 'custom-notes.ai.md');
            const content = fs.readFileSync(filePath, 'utf-8');
            assert.ok(content.includes('id: custom-notes'), 'Frontmatter should include correct id');
        });

        test('written file has exactly 2 frontmatter delimiters (--- open + close)', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            const filePath = path.join(workspaceRoot, '.tasks', 'templates', 'custom-notes.ai.md');
            const content = fs.readFileSync(filePath, 'utf-8');
            const count = (content.match(/^---$/gm) ?? []).length;
            assert.strictEqual(count, 2, 'File must have exactly 2 --- delimiters (one open, one close)');
        });

        test('registers type in memory immediately — getType() succeeds', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            assert.doesNotThrow(() => registry.getType('custom-notes'));
        });

        test('creates .tasks/templates/ directory lazily', () => {
            const templatesDir = path.join(workspaceRoot, '.tasks', 'templates');
            assert.strictEqual(fs.existsSync(templatesDir), false, '.tasks/templates/ should not exist before first persist');
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            assert.ok(fs.existsSync(templatesDir), '.tasks/templates/ should be created after persist');
        });
    });

    // ── Two-tier loading ───────────────────────────────────────────────────

    suite('two-tier loading via initialize()', () => {
        test('workspace template is loaded alongside built-ins after re-initialize()', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            registry.initialize(); // reload from disk
            const ids = registry.getTypes().map(t => t.id);
            assert.ok(ids.includes('custom-notes'), 'workspace type should be present after reload');
            assert.ok(ids.includes('research'), 'built-in type should still be present');
        });

        test('workspace template with same id overrides the built-in', () => {
            const overriddenResearch: ArtifactType = {
                id: 'research',
                displayName: 'Custom Research Override',
                description: 'Workspace-level research.',
                filename: 'research.ai.md',
                templateBody: '# My Custom Research\n\n## Findings\n',
            };
            registry.registerAndPersistType(workspaceRoot, overriddenResearch);
            registry.initialize();
            assert.strictEqual(
                registry.getType('research').displayName,
                'Custom Research Override',
                'Workspace override should win over built-in'
            );
        });

        test('total type count is 6 when one unique workspace type is added', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            registry.initialize();
            assert.strictEqual(registry.getTypes().length, 6); // 5 built-ins + 1 new
        });

        test('overriding a built-in type keeps total count at 5', () => {
            const overrideBuiltIn: ArtifactType = { ...CUSTOM_TYPE, id: 'review' };
            registry.registerAndPersistType(workspaceRoot, overrideBuiltIn);
            registry.initialize();
            assert.strictEqual(registry.getTypes().length, 5); // still 5, one replaced
        });

        test('re-initialize() drops in-memory-only registrations', () => {
            registry.registerType({ ...CUSTOM_TYPE, id: 'ephemeral-type' });
            assert.ok(registry.getTypes().map(t => t.id).includes('ephemeral-type'));
            registry.initialize(); // re-init: only loads from disk
            assert.ok(
                !registry.getTypes().map(t => t.id).includes('ephemeral-type'),
                'In-memory-only type should be gone after re-initialize()'
            );
        });

        test('workspace template getTemplate() returns body without frontmatter after reload', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            registry.initialize();
            const body = registry.getTemplate('custom-notes');
            assert.ok(!body.trimStart().startsWith('---'), 'Reloaded workspace template body must not contain frontmatter');
            assert.ok(body.includes('# Custom Notes'), 'Reloaded template body should contain original content');
        });
    });
});
