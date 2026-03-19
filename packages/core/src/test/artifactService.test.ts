import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArtifactService } from '../services/artifactService.js';
import { ArtifactRegistry } from '../services/artifactRegistry.js';
import { TaskManager } from '../services/taskManager.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** A stable task ID used across most tests. */
const TASK_ID = 'my-test-task';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-artifact-test-'));
}

function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ArtifactService', () => {
    let workspaceRoot: string;
    let taskManager: TaskManager;
    let registry: ArtifactRegistry;
    let service: ArtifactService;

    // We still need a path for extensionRoot, though registry currently uses __dirname
    // to find built-ins. We'll pass the current package root.
    const packageRoot = path.resolve(process.cwd());

    beforeEach(() => {
        workspaceRoot = makeTmpWorkspace();
        taskManager = new TaskManager(workspaceRoot);
        // Registry initialization
        registry = new ArtifactRegistry(packageRoot, workspaceRoot);
        registry.initialize();
        service = new ArtifactService(workspaceRoot, taskManager, registry);
        // Create a default test task so most tests have a valid task to operate on.
        taskManager.createTask(TASK_ID);
    });

    afterEach(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    // ── listArtifacts ──────────────────────────────────────────────────────

    describe('listArtifacts', () => {
        it('returns an entry for every registered type when task has no artifacts', () => {
            const infos = service.listArtifacts(TASK_ID);
            assert.strictEqual(infos.length, registry.getTypes().length);
        });

        it('all entries have exists: false when no artifacts are written yet', () => {
            const infos = service.listArtifacts(TASK_ID);
            assert.ok(infos.every(i => !i.exists), 'All exists flags should be false before any writes');
        });

        it('exists: true only for artifact files present on disk (mixed flags)', () => {
            // Manually write one artifact file to disk.
            const taskDir = path.join(workspaceRoot, '.tasks', TASK_ID);
            fs.mkdirSync(taskDir, { recursive: true });
            fs.writeFileSync(path.join(taskDir, 'task-details.ai.md'), '# Task Details', 'utf-8');

            const infos = service.listArtifacts(TASK_ID);
            const taskDetails = infos.find(i => i.type.id === 'task-details');

            assert.strictEqual(taskDetails?.exists, true, 'task-details should be marked as existing');
            assert.ok(infos.every(i => i.type.id === 'task-details' ? i.exists : !i.exists));
        });

        it('ArtifactInfo.path resolves to correct absolute path', () => {
            const infos = service.listArtifacts(TASK_ID);
            const taskDetails = infos.find(i => i.type.id === 'task-details');
            const expected = path.join(workspaceRoot, '.tasks', TASK_ID, 'task-details.ai.md');
            assert.strictEqual(taskDetails?.path, expected);
        });

        it('ArtifactInfo.type carries the full type metadata', () => {
            const infos = service.listArtifacts(TASK_ID);
            const taskDetails = infos.find(i => i.type.id === 'task-details');
            assert.ok(taskDetails, 'task-details entry should be present');
            assert.ok(taskDetails.type.displayName.length > 0);
            assert.strictEqual(taskDetails.type.filename, 'task-details.ai.md');
        });

        it('throws for a non-existent task ID', () => {
            assert.throws(
                () => service.listArtifacts('no-such-task'),
                /Task 'no-such-task' not found\./
            );
        });
    });

    // ── getArtifact ────────────────────────────────────────────────────────

    describe('getArtifact', () => {
        it('returns the file content when the artifact exists on disk', () => {
            const content = '# Task Details\n\nSome findings here.';
            service.updateArtifact(TASK_ID, 'task-details', content);
            assert.strictEqual(service.getArtifact(TASK_ID, 'task-details'), content);
        });

        it('returns template body when artifact does not exist on disk', () => {
            const body = service.getArtifact(TASK_ID, 'task-details');
            assert.ok(body.length > 0, 'Should return non-empty template body');
        });

        it('template body returned for missing artifact has no YAML frontmatter', () => {
            const body = service.getArtifact(TASK_ID, 'task-details');
            assert.ok(
                !body.trimStart().startsWith('---'),
                'Template fallback must not contain YAML frontmatter'
            );
        });

        it('template fallback contains Markdown headings for each built-in type', () => {
            for (const type of registry.getTypes()) {
                const body = service.getArtifact(TASK_ID, type.id);
                assert.ok(body.includes('#'), `Template for '${type.id}' should contain Markdown headings`);
            }
        });

        it('works gracefully when task directory does not exist yet', () => {
            // Task exists in the index but has never had a file written (no dir on disk).
            assert.doesNotThrow(() => service.getArtifact(TASK_ID, 'task-details'));
        });

        it('throws when task does not exist in the index', () => {
            assert.throws(
                () => service.getArtifact('ghost-task', 'task-details'),
                /Cannot get artifact: task 'ghost-task' not found\./
            );
        });

        it('throws for an unknown artifact type', () => {
            assert.throws(
                () => service.getArtifact(TASK_ID, 'unknown-type'),
                /Unknown artifact type 'unknown-type'\./
            );
        });
    });

    // ── updateArtifact ─────────────────────────────────────────────────────

    describe('updateArtifact', () => {
        it('creates the artifact file on disk', () => {
            service.updateArtifact(TASK_ID, 'task-details', '# Task Details\n\nContent.');
            const filePath = path.join(workspaceRoot, '.tasks', TASK_ID, 'task-details.ai.md');
            assert.ok(fs.existsSync(filePath), 'Artifact file should exist after update');
        });

        it('written file content matches the supplied string exactly', () => {
            const content = '# Task Details\n\nSome findings.';
            service.updateArtifact(TASK_ID, 'task-details', content);
            const filePath = path.join(workspaceRoot, '.tasks', TASK_ID, 'task-details.ai.md');
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), content);
        });

        it('creates the .tasks/{taskId}/ directory lazily on first write', () => {
            const taskDir = path.join(workspaceRoot, '.tasks', TASK_ID);
            assert.strictEqual(fs.existsSync(taskDir), false, 'Directory should not exist before first write');
            service.updateArtifact(TASK_ID, 'task-details', '# Task Details');
            assert.ok(fs.existsSync(taskDir), 'Directory should exist after first write');
        });

        it('overwrites existing artifact with new content', () => {
            service.updateArtifact(TASK_ID, 'task-details', '# First version');
            service.updateArtifact(TASK_ID, 'task-details', '# Second version');
            const filePath = path.join(workspaceRoot, '.tasks', TASK_ID, 'task-details.ai.md');
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), '# Second version');
        });

        it('after update, listArtifacts shows exists: true for the written type', () => {
            service.updateArtifact(TASK_ID, 'task-details', '# Task Details');
            const infos = service.listArtifacts(TASK_ID);
            assert.strictEqual(
                infos.find(i => i.type.id === 'task-details')?.exists,
                true
            );
        });

        it('after update, getArtifact returns the written content', () => {
            const content = '# Task Details\n\nPersisted content.';
            service.updateArtifact(TASK_ID, 'task-details', content);
            assert.strictEqual(service.getArtifact(TASK_ID, 'task-details'), content);
        });


        it('throws for a non-existent task ID', () => {
            assert.throws(
                () => service.updateArtifact('ghost-task', 'task-details', '# content'),
                /Task 'ghost-task' not found\./
            );
        });

        it('throws for an unknown artifact type', () => {
            assert.throws(
                () => service.updateArtifact(TASK_ID, 'unknown-type', '# content'),
                /Unknown artifact type 'unknown-type'\./
            );
        });

        it('task validation error takes precedence over type validation error', () => {
            // Both task and type are invalid — task check fires first.
            assert.throws(
                () => service.updateArtifact('ghost-task', 'unknown-type', '# content'),
                /Task 'ghost-task' not found\./
            );
        });
    });

    // ── Hierarchical Path Resolution ──────────────────────────────────────────

    describe('Hierarchical Path Resolution', () => {
        const PROJECT_ID = 'my-project';
        const SUBTASK_ID = 'my-subtask';

        beforeEach(() => {
            // Setup a project and a subtask
            taskManager.createTask(PROJECT_ID, 'project');
            taskManager.createTask(SUBTASK_ID, 'task', PROJECT_ID);
        });

        it('resolves subtask artifacts to nested project directory: .tasks/${projectId}/${subtaskId}/', () => {
            service.updateArtifact(SUBTASK_ID, 'task-details', '# Subtask Details', PROJECT_ID);
            const expectedPath = path.join(workspaceRoot, '.tasks', PROJECT_ID, SUBTASK_ID, 'task-details.ai.md');
            assert.ok(fs.existsSync(expectedPath), 'Subtask artifact should be in the nested project directory');
        });

        it('resolves top-level project artifacts to root directory: .tasks/${projectId}/', () => {
            service.updateArtifact(PROJECT_ID, 'task-details', '# Project Details');
            const expectedPath = path.join(workspaceRoot, '.tasks', PROJECT_ID, 'task-details.ai.md');
            assert.ok(fs.existsSync(expectedPath), 'Project artifact should be in the .tasks/${projectId}/ directory');
        });

        it('listArtifacts returns correct absolute paths for subtasks', () => {
            const infos = service.listArtifacts(SUBTASK_ID, PROJECT_ID);
            const taskDetails = infos.find(i => i.type.id === 'task-details');
            const expectedPath = path.join(workspaceRoot, '.tasks', PROJECT_ID, SUBTASK_ID, 'task-details.ai.md');
            assert.strictEqual(taskDetails?.path, expectedPath);
        });

        it('getArtifact retrieves content from nested directory for subtasks', () => {
            const content = '# Nested content';
            service.updateArtifact(SUBTASK_ID, 'task-details', content, PROJECT_ID);
            assert.strictEqual(service.getArtifact(SUBTASK_ID, 'task-details', PROJECT_ID), content);
        });

        it('supports explicit parentTaskId in listArtifacts', () => {
            const result = service.listArtifacts(SUBTASK_ID, PROJECT_ID);
            assert.ok(result.length > 0);
            const taskDetails = result.find(i => i.type.id === 'task-details');
            assert.strictEqual(taskDetails?.exists, false);
        });

        it('supports explicit parentTaskId in updateArtifact and getArtifact', () => {
            const content = '# Explicit Parent Details';
            service.updateArtifact(SUBTASK_ID, 'task-details', content, PROJECT_ID);

            const retrieved = service.getArtifact(SUBTASK_ID, 'task-details', PROJECT_ID);
            assert.strictEqual(retrieved, content);

            // Verify it was actually written to the nested path
            const expectedPath = path.join(workspaceRoot, '.tasks', PROJECT_ID, SUBTASK_ID, 'task-details.ai.md');
            assert.ok(fs.existsSync(expectedPath));
        });

        it('throws in updateArtifact if subtask is not found in the specified parent project', () => {
            assert.throws(
                () => service.updateArtifact(SUBTASK_ID, 'task-details', '# content', 'wrong-project'),
                /Task 'my-subtask' not found in project 'wrong-project'\./
            );
        });
    });
});
