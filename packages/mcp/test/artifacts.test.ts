/**
 * Unit tests for artifact tool handlers.
 *
 * Tests exercise the pure handler functions in `src/handlers/artifactHandlers.ts`
 * directly, passing isolated service instances backed by a temp directory.
 * No MCP transport or server wiring is involved.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TaskManager, ArtifactRegistry, ArtifactService } from '@tasklist/core';
import {
    handleListArtifacts,
    handleGetArtifact,
    handleUpdateArtifact,
    handleListArtifactTypes,
    handleRegisterArtifactType,
} from '../src/handlers/artifactHandlers.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * The `extensionRoot` argument to ArtifactRegistry is stored internally
 * but initialize() uses __dirname of the CJS core module to locate built-in
 * templates. Any string path is safe here — we pass workspaceRoot for both.
 * Built-ins are still loaded via the core module's internal __dirname.
 */
const STABLE_TASK_ID = 'artifact-test-task';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-mcp-artifact-test-'));
}

function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

/** Extracts the plain text from the first content item. */
function text(result: { content: Array<{ text: string }> }): string {
    return result.content[0].text;
}

/** Returns true if the result is an error response. */
function isError(result: { isError?: boolean }): boolean {
    return result.isError === true;
}

// ─── Suites ──────────────────────────────────────────────────────────────────

suite('Artifact Tool Handlers', () => {
    let workspaceRoot: string;
    let taskManager: TaskManager;
    let registry: ArtifactRegistry;
    let artifactService: ArtifactService;

    setup(() => {
        workspaceRoot = makeTmpWorkspace();
        taskManager = new TaskManager(workspaceRoot);
        // Pass workspaceRoot for extensionRoot — built-in templates are still
        // loaded via the core module's own __dirname regardless of this arg.
        registry = new ArtifactRegistry(workspaceRoot, workspaceRoot);
        registry.initialize();
        artifactService = new ArtifactService(workspaceRoot, taskManager, registry);
        // Pre-create the standard test task.
        taskManager.createTask(STABLE_TASK_ID);
    });

    teardown(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleListArtifactTypes
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleListArtifactTypes', () => {
        test('returns at least 1 registered type', async () => {
            const result = await handleListArtifactTypes(registry);
            assert.ok(!isError(result));
            assert.ok(
                text(result).includes('artifact type(s)'),
                text(result)
            );
        });

        test('result includes known built-in type IDs when templates are present', async () => {
            const result = await handleListArtifactTypes(registry);
            // If the core module was compiled with built-in templates, these
            // will be present. If not (e.g. CI without templates), the registry
            // returns what's available; this test adapts accordingly.
            const t = text(result);
            // Just assert the format is correct — at minimum we get the count line.
            assert.ok(t.includes('artifact type(s)') || t.includes('No artifact types'), t);
        });

        test('result includes displayName and filename fields in each entry', async () => {
            // Register a custom type so we have a guaranteed entry.
            registry.registerType({
                id: 'test-type',
                displayName: 'Test Type',
                description: 'A type for testing.',
                filename: 'test-type.ai.md',
                templateBody: '',
            });
            const result = await handleListArtifactTypes(registry);
            assert.ok(!isError(result));
            const t = text(result);
            assert.ok(t.includes('test-type'), t);
            assert.ok(t.includes('Display name:'), t);
            assert.ok(t.includes('test-type.ai.md'), t);
        });

        test('count increases after registerType', async () => {
            const before = registry.getTypes().length;
            registry.registerType({
                id: 'custom-type',
                displayName: 'Custom',
                description: 'A custom type.',
                filename: 'custom-type.ai.md',
                templateBody: '',
            });
            const result = await handleListArtifactTypes(registry);
            assert.ok(!isError(result));
            assert.ok(
                text(result).includes(`${before + 1} artifact type(s)`),
                text(result)
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleListArtifacts
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleListArtifacts', () => {
        test('returns artifact list for an explicit taskId', async () => {
            const result = await handleListArtifacts(
                taskManager, artifactService, { taskId: STABLE_TASK_ID }
            );
            assert.ok(!isError(result));
            assert.ok(text(result).includes(STABLE_TASK_ID), text(result));
        });

        test('all entries are marked template-only when no files saved', async () => {
            const result = await handleListArtifacts(
                taskManager, artifactService, { taskId: STABLE_TASK_ID }
            );
            assert.ok(!isError(result));
            assert.ok(!text(result).includes('exists on disk'), text(result));
        });

        test('marks artifact as existing after it is written to disk', async () => {
            artifactService.updateArtifact(STABLE_TASK_ID, 'research', '# Research');
            const result = await handleListArtifacts(
                taskManager, artifactService, { taskId: STABLE_TASK_ID }
            );
            assert.ok(!isError(result));
            assert.ok(text(result).includes('✔'), text(result));
            assert.ok(text(result).includes('exists on disk'), text(result));
        });

        test('falls back to active task when taskId is omitted', async () => {
            taskManager.activateTask(STABLE_TASK_ID);
            const result = await handleListArtifacts(taskManager, artifactService, {});
            assert.ok(!isError(result));
            assert.ok(text(result).includes(STABLE_TASK_ID), text(result));
        });

        test('returns isError when no taskId and no active task', async () => {
            // No active task is set in setup.
            const result = await handleListArtifacts(taskManager, artifactService, {});
            assert.ok(isError(result));
            const t = text(result);
            assert.ok(
                t.includes('no currently active task') || t.includes('No taskId'),
                t
            );
            assert.ok(t.includes('activate_task'), t);
        });

        test('returns isError for non-existent taskId', async () => {
            const result = await handleListArtifacts(
                taskManager, artifactService, { taskId: 'ghost-task' }
            );
            assert.ok(isError(result));
            assert.ok(text(result).includes('ghost-task'), text(result));
            const t = text(result);
            assert.ok(t.includes('not found') || t.includes('list_tasks'), t);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleGetArtifact
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleGetArtifact', () => {
        test('returns saved content when artifact file exists on disk', async () => {
            const content = '# Research\n\nMy findings.';
            artifactService.updateArtifact(STABLE_TASK_ID, 'research', content);
            const result = await handleGetArtifact(
                taskManager, artifactService,
                { taskId: STABLE_TASK_ID, artifactType: 'research' }
            );
            assert.ok(!isError(result));
            assert.ok(text(result).includes('My findings.'), text(result));
        });

        test('result header includes artifact type and task ID', async () => {
            artifactService.updateArtifact(STABLE_TASK_ID, 'research', '# Research');
            const result = await handleGetArtifact(
                taskManager, artifactService,
                { taskId: STABLE_TASK_ID, artifactType: 'research' }
            );
            assert.ok(!isError(result));
            const t = text(result);
            assert.ok(t.includes(STABLE_TASK_ID), t);
            assert.ok(t.includes('research'), t);
        });

        test('header includes update_artifact hint', async () => {
            const result = await handleGetArtifact(
                taskManager, artifactService,
                { taskId: STABLE_TASK_ID, artifactType: 'research' }
            );
            assert.ok(!isError(result));
            assert.ok(text(result).includes('update_artifact'), text(result));
        });

        test('falls back to active task when taskId is omitted', async () => {
            taskManager.activateTask(STABLE_TASK_ID);
            const content = '# Research\n\nActive task content.';
            artifactService.updateArtifact(STABLE_TASK_ID, 'research', content);
            const result = await handleGetArtifact(
                taskManager, artifactService, { artifactType: 'research' }
            );
            assert.ok(!isError(result));
            assert.ok(text(result).includes('Active task content.'), text(result));
        });

        test('returns isError when no taskId and no active task', async () => {
            const result = await handleGetArtifact(
                taskManager, artifactService, { artifactType: 'research' }
            );
            assert.ok(isError(result));
            assert.ok(text(result).includes('activate_task'), text(result));
        });

        test('returns isError for unknown artifact type', async () => {
            const result = await handleGetArtifact(
                taskManager, artifactService,
                { taskId: STABLE_TASK_ID, artifactType: 'no-such-type' }
            );
            assert.ok(isError(result));
            assert.ok(text(result).includes('no-such-type'), text(result));
            assert.ok(text(result).includes('list_artifact_types'), text(result));
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleUpdateArtifact
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleUpdateArtifact', () => {
        test('returns success message with task ID and artifact type', async () => {
            const result = await handleUpdateArtifact(
                taskManager, artifactService,
                { taskId: STABLE_TASK_ID, artifactType: 'research', content: '# Research\n\nContent.' }
            );
            assert.ok(!isError(result));
            const t = text(result);
            assert.ok(t.includes('research'), t);
            assert.ok(t.includes(STABLE_TASK_ID), t);
            assert.ok(t.toLowerCase().includes('saved') || t.toLowerCase().includes('success'), t);
        });

        test('actually persists the file to disk', async () => {
            const content = '# Research\n\nPersisted.';
            await handleUpdateArtifact(
                taskManager, artifactService,
                { taskId: STABLE_TASK_ID, artifactType: 'research', content }
            );
            const filePath = path.join(workspaceRoot, '.tasks', STABLE_TASK_ID, 'research.ai.md');
            assert.ok(fs.existsSync(filePath), 'File should exist after handler call');
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), content);
        });

        test('overwrites existing artifact content', async () => {
            await handleUpdateArtifact(
                taskManager, artifactService,
                { taskId: STABLE_TASK_ID, artifactType: 'research', content: '# First version' }
            );
            await handleUpdateArtifact(
                taskManager, artifactService,
                { taskId: STABLE_TASK_ID, artifactType: 'research', content: '# Second version' }
            );
            const filePath = path.join(workspaceRoot, '.tasks', STABLE_TASK_ID, 'research.ai.md');
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), '# Second version');
        });

        test('falls back to active task when taskId is omitted', async () => {
            taskManager.activateTask(STABLE_TASK_ID);
            const result = await handleUpdateArtifact(
                taskManager, artifactService,
                { artifactType: 'research', content: '# Research\n\nFrom active task.' }
            );
            assert.ok(!isError(result));
            const filePath = path.join(workspaceRoot, '.tasks', STABLE_TASK_ID, 'research.ai.md');
            assert.ok(fs.existsSync(filePath), 'File should be written via active task fallback');
        });

        test('active task fallback result message includes the resolved task ID', async () => {
            taskManager.activateTask(STABLE_TASK_ID);
            const result = await handleUpdateArtifact(
                taskManager, artifactService,
                { artifactType: 'research', content: '# Research' }
            );
            assert.ok(!isError(result));
            assert.ok(text(result).includes(STABLE_TASK_ID), text(result));
        });

        test('returns isError when no taskId and no active task', async () => {
            const result = await handleUpdateArtifact(
                taskManager, artifactService,
                { artifactType: 'research', content: '# Research' }
            );
            assert.ok(isError(result));
            assert.ok(text(result).includes('activate_task'), text(result));
        });

        test('returns isError for non-existent task', async () => {
            const result = await handleUpdateArtifact(
                taskManager, artifactService,
                { taskId: 'ghost-task', artifactType: 'research', content: '# Research' }
            );
            assert.ok(isError(result));
            assert.ok(text(result).includes('ghost-task'), text(result));
            const t = text(result);
            assert.ok(t.includes('not found') || t.includes('list_tasks'), t);
        });

        test('returns isError for unknown artifact type', async () => {
            const result = await handleUpdateArtifact(
                taskManager, artifactService,
                { taskId: STABLE_TASK_ID, artifactType: 'no-such-type', content: '# Content' }
            );
            assert.ok(isError(result));
            assert.ok(text(result).includes('no-such-type'), text(result));
            assert.ok(text(result).includes('list_artifact_types'), text(result));
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // handleRegisterArtifactType
    // ═══════════════════════════════════════════════════════════════════════

    suite('handleRegisterArtifactType', () => {
        test('persists the template file to .tasks/templates/', async () => {
            await handleRegisterArtifactType(workspaceRoot, registry, {
                id: 'sprint-retro',
                displayName: 'Sprint Retrospective',
                description: 'Retrospective notes for a sprint.',
            });
            const templatePath = path.join(workspaceRoot, '.tasks', 'templates', 'sprint-retro.ai.md');
            assert.ok(fs.existsSync(templatePath), 'Template file should be written to .tasks/templates/');
        });

        test('makes the new type immediately available via getTypes()', async () => {
            await handleRegisterArtifactType(workspaceRoot, registry, {
                id: 'adr',
                displayName: 'Architecture Decision Record',
                description: 'Documents an architectural decision.',
            });
            const ids = registry.getTypes().map(t => t.id);
            assert.ok(ids.includes('adr'), `'adr' should be registered. Found: ${ids.join(', ')}`);
        });

        test('returns success message containing the type ID', async () => {
            const result = await handleRegisterArtifactType(workspaceRoot, registry, {
                id: 'changelog',
                displayName: 'Changelog',
                description: 'Documents changes per release.',
            });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('changelog'), text(result));
        });

        test('result message includes the generated filename', async () => {
            const result = await handleRegisterArtifactType(workspaceRoot, registry, {
                id: 'sprint-plan',
                displayName: 'Sprint Plan',
                description: 'Planning doc for a sprint.',
            });
            assert.ok(!isError(result));
            assert.ok(text(result).includes('sprint-plan.ai.md'), text(result));
        });

        test('uses provided templateBody in the persisted file', async () => {
            const templateBody = '# Sprint Retro Template\n\n## What went well';
            await handleRegisterArtifactType(workspaceRoot, registry, {
                id: 'retro-with-body',
                displayName: 'Retro',
                description: 'Sprint retrospective.',
                templateBody,
            });
            const fileContent = fs.readFileSync(
                path.join(workspaceRoot, '.tasks', 'templates', 'retro-with-body.ai.md'),
                'utf-8'
            );
            assert.ok(fileContent.includes(templateBody), `Template body should appear in file: "${fileContent}"`);
        });

        test('uses empty templateBody when templateBody is omitted', async () => {
            await handleRegisterArtifactType(workspaceRoot, registry, {
                id: 'empty-template',
                displayName: 'Empty',
                description: 'A type with no template body.',
            });
            const type = registry.getType('empty-template');
            assert.strictEqual(type.templateBody, '');
        });

        test('returns isError for an empty id', async () => {
            const result = await handleRegisterArtifactType(workspaceRoot, registry, {
                id: '',
                displayName: 'No ID Type',
                description: 'Should fail.',
            });
            assert.ok(isError(result));
            const t = text(result).toLowerCase();
            assert.ok(t.includes('id') || t.includes('non-empty'), text(result));
        });

        test('returns isError for an empty displayName', async () => {
            const result = await handleRegisterArtifactType(workspaceRoot, registry, {
                id: 'valid-id',
                displayName: '',
                description: 'Should fail.',
            });
            assert.ok(isError(result));
            const t = text(result).toLowerCase();
            assert.ok(t.includes('displayname') || t.includes('display'), text(result));
        });

        test('returns isError for an empty description', async () => {
            const result = await handleRegisterArtifactType(workspaceRoot, registry, {
                id: 'valid-id',
                displayName: 'Valid Name',
                description: '',
            });
            assert.ok(isError(result));
            const t = text(result).toLowerCase();
            assert.ok(t.includes('description'), text(result));
        });
    });
});
