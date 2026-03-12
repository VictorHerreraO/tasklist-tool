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
            fs.writeFileSync(path.join(taskDir, 'research.ai.md'), '# Research', 'utf-8');

            const infos = service.listArtifacts(TASK_ID);
            const research = infos.find(i => i.type.id === 'research');
            const walkthrough = infos.find(i => i.type.id === 'walkthrough');

            assert.strictEqual(research?.exists, true, 'research should be marked as existing');
            assert.strictEqual(walkthrough?.exists, false, 'walkthrough should be marked as non-existing');
        });

        it('ArtifactInfo.path resolves to correct absolute path', () => {
            const infos = service.listArtifacts(TASK_ID);
            const research = infos.find(i => i.type.id === 'research');
            const expected = path.join(workspaceRoot, '.tasks', TASK_ID, 'research.ai.md');
            assert.strictEqual(research?.path, expected);
        });

        it('ArtifactInfo.type carries the full type metadata', () => {
            const infos = service.listArtifacts(TASK_ID);
            const research = infos.find(i => i.type.id === 'research');
            assert.ok(research, 'research entry should be present');
            assert.ok(research.type.displayName.length > 0);
            assert.strictEqual(research.type.filename, 'research.ai.md');
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
            const content = '# Research\n\nSome findings here.';
            service.updateArtifact(TASK_ID, 'research', content);
            assert.strictEqual(service.getArtifact(TASK_ID, 'research'), content);
        });

        it('returns template body when artifact does not exist on disk', () => {
            const body = service.getArtifact(TASK_ID, 'research');
            assert.ok(body.length > 0, 'Should return non-empty template body');
        });

        it('template body returned for missing artifact has no YAML frontmatter', () => {
            const body = service.getArtifact(TASK_ID, 'research');
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
            assert.doesNotThrow(() => service.getArtifact(TASK_ID, 'review'));
        });

        it('returns fallback template even when task does not exist in the index', () => {
            // getArtifact intentionally does NOT validate task existence —
            // it falls back to the template body if the file is absent.
            assert.doesNotThrow(() => service.getArtifact('ghost-task', 'research'));
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
            service.updateArtifact(TASK_ID, 'research', '# Research\n\nContent.');
            const filePath = path.join(workspaceRoot, '.tasks', TASK_ID, 'research.ai.md');
            assert.ok(fs.existsSync(filePath), 'Artifact file should exist after update');
        });

        it('written file content matches the supplied string exactly', () => {
            const content = '# Research\n\nSome findings.';
            service.updateArtifact(TASK_ID, 'research', content);
            const filePath = path.join(workspaceRoot, '.tasks', TASK_ID, 'research.ai.md');
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), content);
        });

        it('creates the .tasks/{taskId}/ directory lazily on first write', () => {
            const taskDir = path.join(workspaceRoot, '.tasks', TASK_ID);
            assert.strictEqual(fs.existsSync(taskDir), false, 'Directory should not exist before first write');
            service.updateArtifact(TASK_ID, 'research', '# Research');
            assert.ok(fs.existsSync(taskDir), 'Directory should exist after first write');
        });

        it('overwrites existing artifact with new content', () => {
            service.updateArtifact(TASK_ID, 'research', '# First version');
            service.updateArtifact(TASK_ID, 'research', '# Second version');
            const filePath = path.join(workspaceRoot, '.tasks', TASK_ID, 'research.ai.md');
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), '# Second version');
        });

        it('after update, listArtifacts shows exists: true for the written type', () => {
            service.updateArtifact(TASK_ID, 'research', '# Research');
            const infos = service.listArtifacts(TASK_ID);
            assert.strictEqual(
                infos.find(i => i.type.id === 'research')?.exists,
                true
            );
        });

        it('after update, getArtifact returns the written content', () => {
            const content = '# Research\n\nPersisted content.';
            service.updateArtifact(TASK_ID, 'research', content);
            assert.strictEqual(service.getArtifact(TASK_ID, 'research'), content);
        });

        it('multiple artifact types can be written independently to same task', () => {
            service.updateArtifact(TASK_ID, 'research', '# Research');
            service.updateArtifact(TASK_ID, 'walkthrough', '# Walkthrough');
            service.updateArtifact(TASK_ID, 'review', '# Review');
            const infos = service.listArtifacts(TASK_ID);
            const existingIds = infos.filter(i => i.exists).map(i => i.type.id);
            assert.ok(existingIds.includes('research'));
            assert.ok(existingIds.includes('walkthrough'));
            assert.ok(existingIds.includes('review'));
            // Default built-ins: analysis, implementation-plan, research, review, task-details, walkthrough (6 total)
            const nonExisting = infos.filter(i => !i.exists);
            assert.strictEqual(nonExisting.length, 3); // analysis, task-details, implementation-plan
        });

        it('throws for a non-existent task ID', () => {
            assert.throws(
                () => service.updateArtifact('ghost-task', 'research', '# content'),
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
});
