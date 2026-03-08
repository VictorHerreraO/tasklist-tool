import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { TaskManager } from '../../services/taskManager.js';
import { ArtifactRegistry } from '../../services/artifactRegistry.js';
import { ArtifactService } from '../../services/artifactService.js';
import { ListArtifactTypesTool } from '../../tools/listArtifactTypesTool.js';
import { ListArtifactsTool } from '../../tools/listArtifactsTool.js';
import { GetArtifactTool } from '../../tools/getArtifactTool.js';
import { UpdateArtifactTool } from '../../tools/updateArtifactTool.js';
import { RegisterArtifactTypeTool } from '../../tools/registerArtifactTypeTool.js';
import {
    IListArtifactsParams,
    IGetArtifactParams,
    IUpdateArtifactParams,
    IRegisterArtifactTypeParams,
} from '../../tools/interfaces.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * At compiled test runtime, __dirname = <project>/out/test/tools/
 * Walking three levels up gives the project root where src/templates/ lives.
 */
const EXTENSION_ROOT = path.resolve(__dirname, '../../..');

/** Stable task ID used across most tests. */
const TASK_ID = 'artifact-test-task';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-artifact-tools-test-'));
}

function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Stub CancellationToken that is never cancelled.
 */
const NEVER_TOKEN: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: new vscode.EventEmitter<unknown>().event,
};

function makeInvokeOptions<T>(input: T): vscode.LanguageModelToolInvocationOptions<T> {
    return { input } as vscode.LanguageModelToolInvocationOptions<T>;
}

function makePrepareOptions<T>(input: T): vscode.LanguageModelToolInvocationPrepareOptions<T> {
    return { input } as vscode.LanguageModelToolInvocationPrepareOptions<T>;
}

/** Returns the text value of the first LanguageModelTextPart in a result. */
function firstTextPart(result: vscode.LanguageModelToolResult): string {
    const part = result.content[0];
    if (part instanceof vscode.LanguageModelTextPart) {
        return part.value;
    }
    throw new Error('Expected first content item to be a LanguageModelTextPart');
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

suite('Artifact Management Tools', () => {
    let workspaceRoot: string;
    let taskManager: TaskManager;
    let registry: ArtifactRegistry;
    let artifactService: ArtifactService;

    setup(() => {
        workspaceRoot = makeTmpWorkspace();
        taskManager = new TaskManager(workspaceRoot);
        registry = new ArtifactRegistry(EXTENSION_ROOT, workspaceRoot);
        registry.initialize();
        artifactService = new ArtifactService(workspaceRoot, taskManager, registry);
        // Pre-create a standard task so most tests have a valid target.
        taskManager.createTask(TASK_ID);
    });

    teardown(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ListArtifactTypesTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('ListArtifactTypesTool', () => {
        let tool: ListArtifactTypesTool;

        setup(() => {
            tool = new ListArtifactTypesTool(registry);
        });

        // ── invoke: happy-path ───────────────────────────────────────────

        test('invoke returns all 5 default built-in types', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<Record<string, never>>({}),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('5 artifact type(s)'), text);
        });

        test('invoke result includes the "research" type ID', async () => {
            const result = await tool.invoke(makeInvokeOptions<Record<string, never>>({}), NEVER_TOKEN);
            assert.ok(firstTextPart(result).includes('research'));
        });

        test('invoke result includes the "walkthrough" type', async () => {
            const result = await tool.invoke(makeInvokeOptions<Record<string, never>>({}), NEVER_TOKEN);
            assert.ok(firstTextPart(result).includes('walkthrough'));
        });

        test('invoke result includes the "task-details" type', async () => {
            const result = await tool.invoke(makeInvokeOptions<Record<string, never>>({}), NEVER_TOKEN);
            assert.ok(firstTextPart(result).includes('task-details'));
        });

        test('invoke result includes the "review" type', async () => {
            const result = await tool.invoke(makeInvokeOptions<Record<string, never>>({}), NEVER_TOKEN);
            assert.ok(firstTextPart(result).includes('review'));
        });

        test('invoke result includes the "implementation-plan" type', async () => {
            const result = await tool.invoke(makeInvokeOptions<Record<string, never>>({}), NEVER_TOKEN);
            assert.ok(firstTextPart(result).includes('implementation-plan'));
        });

        test('invoke result includes displayName for each type', async () => {
            const result = await tool.invoke(makeInvokeOptions<Record<string, never>>({}), NEVER_TOKEN);
            const text = firstTextPart(result);
            // Each built-in type entry includes "Display name:"
            assert.ok(text.includes('Display name:'), text);
        });

        test('invoke result includes ".ai.md" filename for each type', async () => {
            const result = await tool.invoke(makeInvokeOptions<Record<string, never>>({}), NEVER_TOKEN);
            assert.ok(firstTextPart(result).includes('.ai.md'));
        });

        test('invoke result count increases after registering a custom type', async () => {
            registry.registerType({
                id: 'custom-type',
                displayName: 'Custom',
                description: 'A custom type.',
                filename: 'custom-type.ai.md',
                templateBody: '',
            });
            const result = await tool.invoke(makeInvokeOptions<Record<string, never>>({}), NEVER_TOKEN);
            const text = firstTextPart(result);
            assert.ok(text.includes('6 artifact type(s)'), text);
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation returns a non-empty invocationMessage', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<Record<string, never>>({}),
                NEVER_TOKEN
            );
            assert.ok(prep.invocationMessage, 'invocationMessage should be present');
        });

        test('prepareInvocation returns confirmationMessages with title and message', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<Record<string, never>>({}),
                NEVER_TOKEN
            );
            assert.ok(prep.confirmationMessages?.title, 'title should be present');
            assert.ok(prep.confirmationMessages?.message, 'message should be present');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ListArtifactsTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('ListArtifactsTool', () => {
        let tool: ListArtifactsTool;

        setup(() => {
            tool = new ListArtifactsTool(taskManager, artifactService);
        });

        // ── invoke: explicit taskId ──────────────────────────────────────

        test('invoke with explicit taskId returns artifact list for that task', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<IListArtifactsParams>({ taskId: TASK_ID }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes(TASK_ID), text);
        });

        test('invoke result includes all 5 artifact type entries', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<IListArtifactsParams>({ taskId: TASK_ID }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            // Count only the per-entry lines, which contain ' — template only' or ' — exists on disk'
            const entryCount = (text.match(/ — (template only|exists on disk)/g) ?? []).length;
            assert.strictEqual(entryCount, 5, `Expected 5 entries, got ${entryCount} in: "${text}"`);
        });

        test('invoke marks all artifacts as template-only when no files saved', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<IListArtifactsParams>({ taskId: TASK_ID }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            // No entry should say 'exists on disk'
            assert.ok(!text.includes('exists on disk'), `No artifact should be marked as saved yet: "${text}"`);
        });

        test('invoke marks an artifact as existing after it is written', async () => {
            artifactService.updateArtifact(TASK_ID, 'research', '# Research');
            const result = await tool.invoke(
                makeInvokeOptions<IListArtifactsParams>({ taskId: TASK_ID }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('✔'), `research artifact should be marked as existing: "${text}"`);
        });

        // ── invoke: active task fallback ─────────────────────────────────

        test('invoke without taskId falls back to active task', async () => {
            taskManager.activateTask(TASK_ID);
            const result = await tool.invoke(
                makeInvokeOptions<IListArtifactsParams>({}),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes(TASK_ID), text);
        });

        test('invoke with active task returns same result as explicit taskId', async () => {
            taskManager.activateTask(TASK_ID);
            const withFallback = await tool.invoke(
                makeInvokeOptions<IListArtifactsParams>({}),
                NEVER_TOKEN
            );
            const withExplicit = await tool.invoke(
                makeInvokeOptions<IListArtifactsParams>({ taskId: TASK_ID }),
                NEVER_TOKEN
            );
            assert.strictEqual(firstTextPart(withFallback), firstTextPart(withExplicit));
        });

        // ── invoke: error handling ───────────────────────────────────────

        test('invoke throws LLM-friendly error when no taskId and no active task', async () => {
            await assert.rejects(
                () => tool.invoke(makeInvokeOptions<IListArtifactsParams>({}), NEVER_TOKEN),
                (err: Error) => {
                    assert.ok(err.message.includes('no currently active task') || err.message.includes('No taskId'), err.message);
                    assert.ok(err.message.includes('activate_task'), err.message);
                    return true;
                }
            );
        });

        test('invoke throws LLM-friendly error for non-existent task', async () => {
            await assert.rejects(
                () => tool.invoke(
                    makeInvokeOptions<IListArtifactsParams>({ taskId: 'ghost-task' }),
                    NEVER_TOKEN
                ),
                (err: Error) => {
                    assert.ok(err.message.includes('ghost-task'), err.message);
                    assert.ok(err.message.includes('not found') || err.message.includes('list_tasks'), err.message);
                    return true;
                }
            );
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation with explicit taskId mentions that ID in invocationMessage', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IListArtifactsParams>({ taskId: TASK_ID }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes(TASK_ID), prep.invocationMessage as string);
        });

        test('prepareInvocation without taskId mentions "active task" in invocationMessage', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IListArtifactsParams>({}),
                NEVER_TOKEN
            );
            const msg = prep.invocationMessage as string;
            assert.ok(msg.includes('active task') || msg.includes('the active'), msg);
        });

        test('prepareInvocation returns confirmationMessages with title and message', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IListArtifactsParams>({ taskId: TASK_ID }),
                NEVER_TOKEN
            );
            assert.ok(prep.confirmationMessages?.title, 'title should be present');
            assert.ok(prep.confirmationMessages?.message, 'message should be present');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // GetArtifactTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('GetArtifactTool', () => {
        let tool: GetArtifactTool;

        setup(() => {
            tool = new GetArtifactTool(taskManager, artifactService);
        });

        // ── invoke: file exists ──────────────────────────────────────────

        test('invoke returns saved content when artifact file exists on disk', async () => {
            const content = '# Research\n\nMy findings.';
            artifactService.updateArtifact(TASK_ID, 'research', content);
            const result = await tool.invoke(
                makeInvokeOptions<IGetArtifactParams>({ taskId: TASK_ID, artifactType: 'research' }),
                NEVER_TOKEN
            );
            assert.ok(firstTextPart(result).includes('My findings.'));
        });

        test('invoke result includes a header with artifact type and task ID', async () => {
            artifactService.updateArtifact(TASK_ID, 'research', '# Research');
            const result = await tool.invoke(
                makeInvokeOptions<IGetArtifactParams>({ taskId: TASK_ID, artifactType: 'research' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes(TASK_ID), text);
            assert.ok(text.includes('research'), text);
        });

        // ── invoke: file does not exist (template fallback) ──────────────

        test('invoke returns template body when artifact file does not exist', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<IGetArtifactParams>({ taskId: TASK_ID, artifactType: 'walkthrough' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            // The template body should have Markdown headings
            assert.ok(text.includes('#'), `Expected Markdown headings in template: "${text}"`);
        });

        test('template body returned has no YAML frontmatter', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<IGetArtifactParams>({ taskId: TASK_ID, artifactType: 'walkthrough' }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            // Strip the header note line to check body
            const body = text.split('\n').slice(3).join('\n');
            assert.ok(!body.trimStart().startsWith('---'), `Frontmatter must not appear in template: "${body}"`);
        });

        test('template fallback includes a "Note" about updating the artifact', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<IGetArtifactParams>({ taskId: TASK_ID, artifactType: 'research' }),
                NEVER_TOKEN
            );
            assert.ok(firstTextPart(result).includes('update_artifact'));
        });

        // ── invoke: active task fallback ─────────────────────────────────

        test('invoke without taskId falls back to active task', async () => {
            taskManager.activateTask(TASK_ID);
            artifactService.updateArtifact(TASK_ID, 'research', '# Research\n\nActive task content.');
            const result = await tool.invoke(
                makeInvokeOptions<IGetArtifactParams>({ artifactType: 'research' }),
                NEVER_TOKEN
            );
            assert.ok(firstTextPart(result).includes('Active task content.'));
        });

        // ── invoke: error handling ───────────────────────────────────────

        test('invoke throws LLM-friendly error when no taskId and no active task', async () => {
            await assert.rejects(
                () => tool.invoke(
                    makeInvokeOptions<IGetArtifactParams>({ artifactType: 'research' }),
                    NEVER_TOKEN
                ),
                (err: Error) => {
                    assert.ok(err.message.includes('activate_task'), err.message);
                    return true;
                }
            );
        });

        test('invoke throws LLM-friendly error for unknown artifact type', async () => {
            await assert.rejects(
                () => tool.invoke(
                    makeInvokeOptions<IGetArtifactParams>({ taskId: TASK_ID, artifactType: 'no-such-type' }),
                    NEVER_TOKEN
                ),
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

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation invocationMessage contains the artifactType', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IGetArtifactParams>({ taskId: TASK_ID, artifactType: 'review' }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes('review'), prep.invocationMessage as string);
        });

        test('prepareInvocation invocationMessage contains the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IGetArtifactParams>({ taskId: TASK_ID, artifactType: 'review' }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes(TASK_ID), prep.invocationMessage as string);
        });

        test('prepareInvocation confirmation message references the artifact type', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IGetArtifactParams>({ taskId: TASK_ID, artifactType: 'review' }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(msg.value.includes('review'), msg.value);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // UpdateArtifactTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('UpdateArtifactTool', () => {
        let tool: UpdateArtifactTool;

        setup(() => {
            tool = new UpdateArtifactTool(taskManager, artifactService);
        });

        // ── invoke: happy-path ───────────────────────────────────────────

        test('invoke returns a success confirmation message', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<IUpdateArtifactParams>({
                    taskId: TASK_ID,
                    artifactType: 'research',
                    content: '# Research\n\nContent.',
                }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('research'), text);
            assert.ok(text.includes(TASK_ID), text);
            assert.ok(text.toLowerCase().includes('saved') || text.toLowerCase().includes('success'), text);
        });

        test('invoke actually persists the file to disk', async () => {
            const content = '# Research\n\nPersisted.';
            await tool.invoke(
                makeInvokeOptions<IUpdateArtifactParams>({
                    taskId: TASK_ID,
                    artifactType: 'research',
                    content,
                }),
                NEVER_TOKEN
            );
            const filePath = path.join(workspaceRoot, '.tasks', TASK_ID, 'research.ai.md');
            assert.ok(fs.existsSync(filePath), 'File should exist after invoke');
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), content);
        });

        test('invoke overwrites existing artifact content', async () => {
            await tool.invoke(
                makeInvokeOptions<IUpdateArtifactParams>({
                    taskId: TASK_ID, artifactType: 'research', content: '# First version',
                }),
                NEVER_TOKEN
            );
            await tool.invoke(
                makeInvokeOptions<IUpdateArtifactParams>({
                    taskId: TASK_ID, artifactType: 'research', content: '# Second version',
                }),
                NEVER_TOKEN
            );
            const filePath = path.join(workspaceRoot, '.tasks', TASK_ID, 'research.ai.md');
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), '# Second version');
        });

        test('invoke can write multiple artifact types to the same task', async () => {
            await tool.invoke(makeInvokeOptions<IUpdateArtifactParams>({
                taskId: TASK_ID, artifactType: 'research', content: '# Research',
            }), NEVER_TOKEN);
            await tool.invoke(makeInvokeOptions<IUpdateArtifactParams>({
                taskId: TASK_ID, artifactType: 'walkthrough', content: '# Walkthrough',
            }), NEVER_TOKEN);

            assert.ok(fs.existsSync(path.join(workspaceRoot, '.tasks', TASK_ID, 'research.ai.md')));
            assert.ok(fs.existsSync(path.join(workspaceRoot, '.tasks', TASK_ID, 'walkthrough.ai.md')));
        });

        // ── invoke: active task fallback ─────────────────────────────────

        test('invoke without taskId falls back to active task', async () => {
            taskManager.activateTask(TASK_ID);
            await assert.doesNotReject(
                () => tool.invoke(
                    makeInvokeOptions<IUpdateArtifactParams>({
                        artifactType: 'research',
                        content: '# Research\n\nFrom active task.',
                    }),
                    NEVER_TOKEN
                )
            );
            const filePath = path.join(workspaceRoot, '.tasks', TASK_ID, 'research.ai.md');
            assert.ok(fs.existsSync(filePath), 'File should be written via active task fallback');
        });

        test('active task fallback result message includes the resolved task ID', async () => {
            taskManager.activateTask(TASK_ID);
            const result = await tool.invoke(
                makeInvokeOptions<IUpdateArtifactParams>({
                    artifactType: 'research',
                    content: '# Research',
                }),
                NEVER_TOKEN
            );
            assert.ok(firstTextPart(result).includes(TASK_ID));
        });

        // ── invoke: error handling ───────────────────────────────────────

        test('invoke throws LLM-friendly error when no taskId and no active task', async () => {
            await assert.rejects(
                () => tool.invoke(
                    makeInvokeOptions<IUpdateArtifactParams>({
                        artifactType: 'research',
                        content: '# Research',
                    }),
                    NEVER_TOKEN
                ),
                (err: Error) => {
                    assert.ok(err.message.includes('activate_task'), err.message);
                    return true;
                }
            );
        });

        test('invoke throws LLM-friendly error for non-existent task', async () => {
            await assert.rejects(
                () => tool.invoke(
                    makeInvokeOptions<IUpdateArtifactParams>({
                        taskId: 'ghost-task',
                        artifactType: 'research',
                        content: '# Research',
                    }),
                    NEVER_TOKEN
                ),
                (err: Error) => {
                    assert.ok(err.message.includes('ghost-task'), err.message);
                    assert.ok(
                        err.message.includes('not found') || err.message.includes('list_tasks'),
                        err.message
                    );
                    return true;
                }
            );
        });

        test('invoke throws LLM-friendly error for unknown artifact type', async () => {
            await assert.rejects(
                () => tool.invoke(
                    makeInvokeOptions<IUpdateArtifactParams>({
                        taskId: TASK_ID,
                        artifactType: 'no-such-type',
                        content: '# Content',
                    }),
                    NEVER_TOKEN
                ),
                (err: Error) => {
                    assert.ok(err.message.includes('no-such-type'), err.message);
                    assert.ok(err.message.includes('list_artifact_types'), err.message);
                    return true;
                }
            );
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation invocationMessage contains the artifactType', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IUpdateArtifactParams>({
                    taskId: TASK_ID, artifactType: 'review', content: '',
                }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes('review'));
        });

        test('prepareInvocation confirmation message contains the taskId', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IUpdateArtifactParams>({
                    taskId: TASK_ID, artifactType: 'review', content: '',
                }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(msg.value.includes(TASK_ID), msg.value);
        });

        test('prepareInvocation confirmation message warns about overwriting', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IUpdateArtifactParams>({
                    taskId: TASK_ID, artifactType: 'review', content: '',
                }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(
                msg.value.toLowerCase().includes('overwrite') || msg.value.toLowerCase().includes('replace'),
                msg.value
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // RegisterArtifactTypeTool
    // ═══════════════════════════════════════════════════════════════════════

    suite('RegisterArtifactTypeTool', () => {
        let tool: RegisterArtifactTypeTool;

        setup(() => {
            tool = new RegisterArtifactTypeTool(workspaceRoot, registry);
        });

        // ── invoke: happy-path ───────────────────────────────────────────

        test('invoke persists the template file to .tasks/templates/', async () => {
            await tool.invoke(
                makeInvokeOptions<IRegisterArtifactTypeParams>({
                    id: 'sprint-retro',
                    displayName: 'Sprint Retrospective',
                    description: 'Retrospective notes for a sprint.',
                }),
                NEVER_TOKEN
            );
            const templatePath = path.join(workspaceRoot, '.tasks', 'templates', 'sprint-retro.ai.md');
            assert.ok(fs.existsSync(templatePath), 'Template file should be written to .tasks/templates/');
        });

        test('invoke makes the new type immediately available via getTypes()', async () => {
            await tool.invoke(
                makeInvokeOptions<IRegisterArtifactTypeParams>({
                    id: 'adr',
                    displayName: 'Architecture Decision Record',
                    description: 'Documents an architectural decision.',
                }),
                NEVER_TOKEN
            );
            const ids = registry.getTypes().map(t => t.id);
            assert.ok(ids.includes('adr'), `'adr' should be registered. Found: ${ids.join(', ')}`);
        });

        test('invoke returns success message containing the type ID', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<IRegisterArtifactTypeParams>({
                    id: 'changelog',
                    displayName: 'Changelog',
                    description: 'Documents changes per release.',
                }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('changelog'), text);
        });

        test('invoke result message includes the generated filename', async () => {
            const result = await tool.invoke(
                makeInvokeOptions<IRegisterArtifactTypeParams>({
                    id: 'sprint-plan',
                    displayName: 'Sprint Plan',
                    description: 'Planning doc for a sprint.',
                }),
                NEVER_TOKEN
            );
            const text = firstTextPart(result);
            assert.ok(text.includes('sprint-plan.ai.md'), text);
        });

        test('invoke uses provided templateBody in the persisted file', async () => {
            const templateBody = '# Sprint Retro Template\n\n## What went well';
            await tool.invoke(
                makeInvokeOptions<IRegisterArtifactTypeParams>({
                    id: 'retro-with-body',
                    displayName: 'Retro',
                    description: 'Sprint retrospective.',
                    templateBody,
                }),
                NEVER_TOKEN
            );
            const fileContent = fs.readFileSync(
                path.join(workspaceRoot, '.tasks', 'templates', 'retro-with-body.ai.md'),
                'utf-8'
            );
            assert.ok(fileContent.includes(templateBody), `Template body should appear in file: "${fileContent}"`);
        });

        test('invoke uses empty templateBody when none is provided', async () => {
            await tool.invoke(
                makeInvokeOptions<IRegisterArtifactTypeParams>({
                    id: 'empty-template',
                    displayName: 'Empty',
                    description: 'A type with no template body.',
                }),
                NEVER_TOKEN
            );
            // The type should be registered without error even with an empty template.
            const type = registry.getType('empty-template');
            assert.strictEqual(type.templateBody, '');
        });

        test('invoke total registered type count increases to 6', async () => {
            await tool.invoke(
                makeInvokeOptions<IRegisterArtifactTypeParams>({
                    id: 'new-type',
                    displayName: 'New Type',
                    description: 'A new custom type.',
                }),
                NEVER_TOKEN
            );
            assert.strictEqual(registry.getTypes().length, 6);
        });

        // ── invoke: error handling ───────────────────────────────────────

        test('invoke throws for an empty id', async () => {
            await assert.rejects(
                () => tool.invoke(
                    makeInvokeOptions<IRegisterArtifactTypeParams>({
                        id: '',
                        displayName: 'No ID Type',
                        description: 'Should fail.',
                    }),
                    NEVER_TOKEN
                ),
                (err: Error) => {
                    assert.ok(err.message.toLowerCase().includes('id') || err.message.toLowerCase().includes('non-empty'), err.message);
                    return true;
                }
            );
        });

        test('invoke throws for an empty displayName', async () => {
            await assert.rejects(
                () => tool.invoke(
                    makeInvokeOptions<IRegisterArtifactTypeParams>({
                        id: 'valid-id',
                        displayName: '',
                        description: 'Should fail.',
                    }),
                    NEVER_TOKEN
                ),
                (err: Error) => {
                    assert.ok(err.message.toLowerCase().includes('displayname') || err.message.toLowerCase().includes('display'), err.message);
                    return true;
                }
            );
        });

        test('invoke throws for an empty description', async () => {
            await assert.rejects(
                () => tool.invoke(
                    makeInvokeOptions<IRegisterArtifactTypeParams>({
                        id: 'valid-id',
                        displayName: 'Valid Name',
                        description: '',
                    }),
                    NEVER_TOKEN
                ),
                (err: Error) => {
                    assert.ok(err.message.toLowerCase().includes('description'), err.message);
                    return true;
                }
            );
        });

        // ── prepareInvocation ────────────────────────────────────────────

        test('prepareInvocation invocationMessage contains the type id', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IRegisterArtifactTypeParams>({
                    id: 'my-type',
                    displayName: 'My Type',
                    description: 'A custom type.',
                }),
                NEVER_TOKEN
            );
            assert.ok((prep.invocationMessage as string).includes('my-type'));
        });

        test('prepareInvocation confirmation message references the id and displayName', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IRegisterArtifactTypeParams>({
                    id: 'my-type',
                    displayName: 'My Display Name',
                    description: 'A custom type.',
                }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(msg.value.includes('my-type'), msg.value);
            assert.ok(msg.value.includes('My Display Name'), msg.value);
        });

        test('prepareInvocation confirmation message mentions the template filename', async () => {
            const prep = await tool.prepareInvocation(
                makePrepareOptions<IRegisterArtifactTypeParams>({
                    id: 'my-type',
                    displayName: 'My Type',
                    description: 'A custom type.',
                }),
                NEVER_TOKEN
            );
            const msg = prep.confirmationMessages?.message as vscode.MarkdownString;
            assert.ok(msg.value.includes('my-type.ai.md'), msg.value);
        });
    });
});
