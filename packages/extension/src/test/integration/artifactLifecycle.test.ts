import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager, ArtifactRegistry, ArtifactService, ArtifactType } from '@tasklist/core';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * At compiled test runtime, __dirname = <project>/out/test/integration/
 * Walking three levels up gives the project root where src/templates/ lives.
 */
const EXTENSION_ROOT = path.resolve(__dirname, '../../..');

/** Built-in type used throughout artifact lifecycle tests. */
const BUILT_IN_TYPE = 'task-details';

/** A second built-in type for multi-type tests. */
const SECOND_BUILT_IN_TYPE = 'walkthrough';

/** Custom type used for register-and-use tests. */
const CUSTOM_TYPE: ArtifactType = {
    id: 'sprint-retro',
    displayName: 'Sprint Retrospective',
    description: 'Documents retrospective findings for a sprint.',
    filename: 'sprint-retro.ai.md',
    templateBody: '# Sprint Retrospective\n\n## What Went Well\n\n## What Could Improve\n',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-artifact-integ-'));
}

function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

/** Returns the absolute disk path for an artifact file. */
function artifactPath(workspaceRoot: string, taskId: string, filename: string): string {
    return path.join(workspaceRoot, '.tasks', taskId, filename);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

suite('Integration – Artifact Lifecycle', () => {
    let workspaceRoot: string;
    let taskManager: TaskManager;
    let registry: ArtifactRegistry;
    let service: ArtifactService;

    setup(() => {
        workspaceRoot = makeTmpWorkspace();
        taskManager = new TaskManager(workspaceRoot);
        registry = new ArtifactRegistry(EXTENSION_ROOT, workspaceRoot);
        registry.initialize();
        registry.registerType({
            id: 'walkthrough',
            displayName: 'Walkthrough',
            description: 'Custom walkthrough',
            filename: 'walkthrough.ai.md',
            templateBody: '# Walkthrough'
        });
        service = new ArtifactService(workspaceRoot, taskManager, registry);
    });

    teardown(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    // ── 1. Template → Content flow ────────────────────────────────────────────

    suite('template → content flow (getArtifact / updateArtifact / listArtifacts)', () => {
        const TASK_ID = 'template-content-task';

        setup(() => {
            taskManager.createTask(TASK_ID);
        });

        test('getArtifact on a new task returns the template body (no frontmatter)', () => {
            const body = service.getArtifact(TASK_ID, BUILT_IN_TYPE);
            assert.ok(body.length > 0, 'Template body should be non-empty');
            assert.ok(
                !body.trimStart().startsWith('---'),
                'Template body must not contain YAML frontmatter'
            );
        });

        test('template body from getArtifact contains Markdown headings', () => {
            const body = service.getArtifact(TASK_ID, BUILT_IN_TYPE);
            assert.ok(body.includes('#'), 'Template body should include Markdown headings');
        });

        test('updateArtifact writes custom content to disk', () => {
            const customContent = '# My Research\n\n## Findings\n\nKey insight here.';
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, customContent);
            const filename = registry.getFilename(BUILT_IN_TYPE);
            const diskContent = fs.readFileSync(artifactPath(workspaceRoot, TASK_ID, filename), 'utf-8');
            assert.strictEqual(diskContent, customContent);
        });

        test('getArtifact after update returns the custom content, not the template', () => {
            const customContent = '# My Research\n\nFindings go here.';
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, customContent);
            const result = service.getArtifact(TASK_ID, BUILT_IN_TYPE);
            assert.strictEqual(result, customContent);
        });

        test('listArtifacts shows exists: true after update', () => {
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, '# Research content');
            const infos = service.listArtifacts(TASK_ID);
            const entry = infos.find(i => i.type.id === BUILT_IN_TYPE);
            assert.ok(entry, `'${BUILT_IN_TYPE}' should appear in list`);
            assert.strictEqual(entry!.exists, true);
        });

        test('listArtifacts shows exists: false for types not yet written', () => {
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, '# Research');
            const infos = service.listArtifacts(TASK_ID);
            const other = infos.find(i => i.type.id === SECOND_BUILT_IN_TYPE);
            assert.strictEqual(other!.exists, false);
        });

        test('updateArtifact overwrites previous content', () => {
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, '# Version 1');
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, '# Version 2');
            const result = service.getArtifact(TASK_ID, BUILT_IN_TYPE);
            assert.strictEqual(result, '# Version 2');
        });
    });

    // ── 2. Multiple artifact types for the same task ──────────────────────────

    suite('multiple artifact types on the same task', () => {
        const TASK_ID = 'multi-type-task';

        setup(() => {
            taskManager.createTask(TASK_ID);
        });

        test('writing two different types creates two distinct files on disk', () => {
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, '# Research');
            service.updateArtifact(TASK_ID, SECOND_BUILT_IN_TYPE, '# Walkthrough');

            const file1 = artifactPath(workspaceRoot, TASK_ID, registry.getFilename(BUILT_IN_TYPE));
            const file2 = artifactPath(workspaceRoot, TASK_ID, registry.getFilename(SECOND_BUILT_IN_TYPE));
            assert.ok(fs.existsSync(file1), 'research.ai.md should exist');
            assert.ok(fs.existsSync(file2), 'walkthrough.ai.md should exist');
        });

        test('listArtifacts shows both types as exists: true after updates', () => {
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, '# Research');
            service.updateArtifact(TASK_ID, SECOND_BUILT_IN_TYPE, '# Walkthrough');
            const infos = service.listArtifacts(TASK_ID);

            assert.strictEqual(infos.find(i => i.type.id === BUILT_IN_TYPE)?.exists, true);
            assert.strictEqual(infos.find(i => i.type.id === SECOND_BUILT_IN_TYPE)?.exists, true);
        });

        test('non-updated types remain exists: false alongside updated types', () => {
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, '# Research');
            service.updateArtifact(TASK_ID, SECOND_BUILT_IN_TYPE, '# Walkthrough');
            const infos = service.listArtifacts(TASK_ID);
            const notUpdated = infos.filter(i => i.type.id !== BUILT_IN_TYPE && i.type.id !== SECOND_BUILT_IN_TYPE);
            assert.ok(notUpdated.every(i => !i.exists), 'Other types should still have exists: false');
        });

        test('each type returns its own correct content via getArtifact', () => {
            const researchContent = '# Research\n\nFindings.';
            const walkthroughContent = '# Walkthrough\n\nSteps.';
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, researchContent);
            service.updateArtifact(TASK_ID, SECOND_BUILT_IN_TYPE, walkthroughContent);

            assert.strictEqual(service.getArtifact(TASK_ID, BUILT_IN_TYPE), researchContent);
            assert.strictEqual(service.getArtifact(TASK_ID, SECOND_BUILT_IN_TYPE), walkthroughContent);
        });

        test('overwriting one type does not corrupt the other', () => {
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, '# Research v1');
            service.updateArtifact(TASK_ID, SECOND_BUILT_IN_TYPE, '# Walkthrough');
            service.updateArtifact(TASK_ID, BUILT_IN_TYPE, '# Research v2');

            assert.strictEqual(service.getArtifact(TASK_ID, BUILT_IN_TYPE), '# Research v2');
            assert.strictEqual(service.getArtifact(TASK_ID, SECOND_BUILT_IN_TYPE), '# Walkthrough');
        });
    });

    // ── 3. Register and use a custom artifact type ────────────────────────────

    suite('register and use a custom artifact type', () => {
        const TASK_ID = 'custom-type-task';

        setup(() => {
            taskManager.createTask(TASK_ID);
        });

        test('registerAndPersistType persists the .ai.md file to .tasks/templates/', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            const templateFile = path.join(workspaceRoot, '.tasks', 'templates', `${CUSTOM_TYPE.id}.ai.md`);
            assert.ok(fs.existsSync(templateFile), 'Custom type template file should exist on disk');
        });

        test('getArtifact with the new type ID returns the custom template body before any writes', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            const body = service.getArtifact(TASK_ID, CUSTOM_TYPE.id);
            assert.ok(body.includes('Sprint Retrospective'), `Body should contain custom template content: ${body}`);
        });

        test('custom template body has no YAML frontmatter when returned via getArtifact', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            const body = service.getArtifact(TASK_ID, CUSTOM_TYPE.id);
            assert.ok(!body.trimStart().startsWith('---'), 'Custom template body must not contain YAML frontmatter');
        });

        test('updateArtifact with the new type ID writes content to disk', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            const content = '# Sprint Retro\n\n## What Went Well\n\nGreat teamwork.';
            service.updateArtifact(TASK_ID, CUSTOM_TYPE.id, content);
            const filePath = artifactPath(workspaceRoot, TASK_ID, CUSTOM_TYPE.filename);
            assert.ok(fs.existsSync(filePath), 'Artifact file should exist after update');
        });

        test('getArtifact after update returns the persisted content', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            const content = '# Sprint Retro\n\n## What Went Well\n\nGreat teamwork.';
            service.updateArtifact(TASK_ID, CUSTOM_TYPE.id, content);
            assert.strictEqual(service.getArtifact(TASK_ID, CUSTOM_TYPE.id), content);
        });

        test('custom type survives registry re-initialization from disk', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            registry.initialize(); // reload from disk
            const ids = registry.getTypes().map(t => t.id);
            assert.ok(ids.includes(CUSTOM_TYPE.id), 'Custom type should still be present after re-initialize()');
        });

        test('listArtifacts includes the custom type after registry is re-initialized', () => {
            registry.registerAndPersistType(workspaceRoot, CUSTOM_TYPE);
            registry.initialize();
            const infos = service.listArtifacts(TASK_ID);
            const entry = infos.find(i => i.type.id === CUSTOM_TYPE.id);
            assert.ok(entry, `Custom type '${CUSTOM_TYPE.id}' should appear in listArtifacts`);
        });
    });

    // ── 4. Error scenarios ────────────────────────────────────────────────────

    suite('error scenarios', () => {

        // ── 4a. Invalid state transitions ─────────────────────────────────────

        suite('invalid task state transitions', () => {
            test('close_task on an open task throws error mentioning start_task', () => {
                taskManager.createTask('open-task');
                assert.throws(
                    () => taskManager.close_task('open-task'),
                    (err: Error) => {
                        assert.ok(err.message.includes('open-task'), err.message);
                        assert.ok(err.message.includes('open'), err.message);
                        assert.ok(
                            err.message.includes('start_task'),
                            `Expected 'start_task' hint in: "${err.message}"`
                        );
                        return true;
                    }
                );
            });

            test('start_task on an in-progress task throws with descriptive status message', () => {
                taskManager.createTask('ip-task');
                taskManager.start_task('ip-task');
                assert.throws(
                    () => taskManager.start_task('ip-task'),
                    (err: Error) => {
                        assert.ok(err.message.includes('ip-task'), err.message);
                        assert.ok(err.message.includes('in-progress'), err.message);
                        assert.ok(err.message.includes('open'), err.message);
                        return true;
                    }
                );
            });

            test('start_task on a closed task throws with descriptive status message', () => {
                taskManager.createTask('closed-task');
                taskManager.start_task('closed-task');
                taskManager.close_task('closed-task');
                assert.throws(
                    () => taskManager.start_task('closed-task'),
                    (err: Error) => {
                        assert.ok(err.message.includes('closed-task'), err.message);
                        assert.ok(err.message.includes('closed'), err.message);
                        return true;
                    }
                );
            });

            test('close_task on an already-closed task throws with descriptive message', () => {
                taskManager.createTask('done-task');
                taskManager.start_task('done-task');
                taskManager.close_task('done-task');
                assert.throws(
                    () => taskManager.close_task('done-task'),
                    (err: Error) => {
                        assert.ok(err.message.includes('done-task'), err.message);
                        assert.ok(err.message.includes('closed'), err.message);
                        return true;
                    }
                );
            });
        });

        // ── 4b. Missing task errors ───────────────────────────────────────────

        suite('missing task errors', () => {
            test('listArtifacts with unknown taskId throws descriptive error', () => {
                assert.throws(
                    () => service.listArtifacts('no-such-task'),
                    (err: Error) => {
                        assert.ok(err.message.includes('no-such-task'), err.message);
                        assert.ok(
                            err.message.includes('not found') || err.message.includes('create_task'),
                            `Expected guidance in: "${err.message}"`
                        );
                        return true;
                    }
                );
            });

            test('updateArtifact with unknown taskId throws descriptive error', () => {
                assert.throws(
                    () => service.updateArtifact('ghost-task', BUILT_IN_TYPE, '# content'),
                    (err: Error) => {
                        assert.ok(err.message.includes('ghost-task'), err.message);
                        assert.ok(
                            err.message.includes('not found') || err.message.includes('create_task'),
                            `Expected guidance in: "${err.message}"`
                        );
                        return true;
                    }
                );
            });

            test('activateTask with unknown taskId throws descriptive error', () => {
                assert.throws(
                    () => taskManager.activateTask('phantom'),
                    (err: Error) => {
                        assert.ok(err.message.includes('phantom'), err.message);
                        assert.ok(err.message.includes('not found'), err.message);
                        return true;
                    }
                );
            });

            test('start_task with unknown taskId throws descriptive error', () => {
                assert.throws(
                    () => taskManager.start_task('ghost'),
                    (err: Error) => {
                        assert.ok(err.message.includes('ghost'), err.message);
                        assert.ok(err.message.includes('not found'), err.message);
                        return true;
                    }
                );
            });
        });

        // ── 4c. Unknown artifact type ─────────────────────────────────────────

        suite('unknown artifact type errors', () => {
            const TASK_ID = 'type-error-task';

            setup(() => {
                taskManager.createTask(TASK_ID);
            });

            test('getArtifact with unknown type ID throws descriptive error', () => {
                assert.throws(
                    () => service.getArtifact(TASK_ID, 'no-such-type'),
                    (err: Error) => {
                        assert.ok(err.message.includes('no-such-type'), err.message);
                        assert.ok(
                            err.message.includes('list_artifact_types'),
                            `Expected 'list_artifact_types' hint in: "${err.message}"`
                        );
                        return true;
                    }
                );
            });

            test('updateArtifact with unknown type ID throws descriptive error', () => {
                assert.throws(
                    () => service.updateArtifact(TASK_ID, 'no-such-type', '# content'),
                    (err: Error) => {
                        assert.ok(err.message.includes('no-such-type'), err.message);
                        assert.ok(
                            err.message.includes('list_artifact_types'),
                            `Expected 'list_artifact_types' hint in: "${err.message}"`
                        );
                        return true;
                    }
                );
            });

            test('registry.getType with unknown type ID throws descriptive error', () => {
                assert.throws(
                    () => registry.getType('totally-unknown'),
                    (err: Error) => {
                        assert.ok(err.message.includes('totally-unknown'), err.message);
                        assert.ok(
                            err.message.includes('list_artifact_types'),
                            `Expected 'list_artifact_types' hint in: "${err.message}"`
                        );
                        return true;
                    }
                );
            });
        });

        // ── 4d. Deactivate with no active task ────────────────────────────────

        suite('deactivate with no active task', () => {
            test('deactivateTask with no active task does not throw', () => {
                // No tasks created — deactivate should be graceful / no-op.
                assert.doesNotThrow(() => taskManager.deactivateTask());
            });

            test('deactivateTask repeatedly is fully idempotent', () => {
                taskManager.createTask('temp');
                taskManager.activateTask('temp');
                taskManager.deactivateTask();
                assert.doesNotThrow(() => taskManager.deactivateTask());
                assert.doesNotThrow(() => taskManager.deactivateTask());
                assert.strictEqual(taskManager.getActiveTask(), null);
            });
        });

        // ── 4e. Duplicate createTask ──────────────────────────────────────────

        suite('duplicate task creation', () => {
            test('createTask with an already-existing ID throws descriptive error', () => {
                taskManager.createTask('dup-id');
                assert.throws(
                    () => taskManager.createTask('dup-id'),
                    (err: Error) => {
                        assert.ok(err.message.includes('dup-id'), err.message);
                        assert.ok(
                            err.message.includes('already exists'),
                            `Expected 'already exists' in: "${err.message}"`
                        );
                        return true;
                    }
                );
            });

            test('duplicate createTask does not corrupt the existing task', () => {
                taskManager.createTask('stable-task');
                taskManager.start_task('stable-task');
                try {
                    taskManager.createTask('stable-task');
                } catch {
                    // Expected — swallow the error.
                }
                // Original task should be unchanged.
                const tasks = taskManager.listTasks();
                assert.strictEqual(tasks.length, 1);
                assert.strictEqual(tasks[0].id, 'stable-task');
                assert.strictEqual(tasks[0].status, 'in-progress');
            });
        });
    });
});
