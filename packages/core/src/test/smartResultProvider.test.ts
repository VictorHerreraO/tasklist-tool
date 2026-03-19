import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager } from '../services/taskManager.js';
import { SmartResultProvider } from '../services/smartResultProvider.js';

/** Creates an isolated temp directory for a test workspace. */
function makeTmpWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-smart-test-'));
}

/** Removes the temp directory and all its contents. */
function removeTmpWorkspace(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

describe('SmartResultProvider', () => {
    let workspaceRoot: string;
    let manager: TaskManager;
    let provider: SmartResultProvider;

    beforeEach(() => {
        workspaceRoot = makeTmpWorkspace();
        manager = new TaskManager(workspaceRoot);
        provider = new SmartResultProvider(manager);
    });

    afterEach(() => {
        removeTmpWorkspace(workspaceRoot);
    });

    describe('getRecentProjects', () => {
        it('returns empty array when no projects exist', () => {
            const recent = provider.getRecentProjects();
            assert.deepStrictEqual(recent, []);
        });

        it('returns up to 5 projects sorted by recency', async () => {
            // Create 7 projects with different update times
            // We use a small delay or manually set updatedAt if the model allowed it, 
            // but here we just rely on the order of creation since createTask sets updatedAt.
            for (let i = 1; i <= 7; i++) {
                manager.createTask(`proj-${i}`, 'project');
                // Artificial delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 2));
            }

            const recent = provider.getRecentProjects();
            assert.strictEqual(recent.length, 5);
            // Most recent should be proj-7
            assert.strictEqual(recent[0].id, 'proj-7');
            assert.strictEqual(recent[4].id, 'proj-3');
        });

    });

    describe('searchProjects', () => {
        beforeEach(() => {
            manager.createTask('auth-service', 'project');
            manager.createTask('api-gateway', 'project');
            manager.createTask('frontend-app', 'project');
            manager.createTask('database-migration', 'project');
        });

        it('returns all recent projects if query is empty or whitespace', () => {
            const results = provider.searchProjects('  ');
            assert.strictEqual(results.length, 4);
        });

        it('finds projects by exact match', () => {
            const results = provider.searchProjects('api-gateway');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].id, 'api-gateway');
        });

        it('finds projects by case-insensitive match', () => {
            const results = provider.searchProjects('API-GATEWAY');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].id, 'api-gateway');
        });

        it('finds projects by prefix', () => {
            const results = provider.searchProjects('auth');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].id, 'auth-service');
        });

        it('finds projects by substring', () => {
            const results = provider.searchProjects('service');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].id, 'auth-service');
        });

        it('finds projects by fuzzy subsequence', () => {
            // 'fnt' matches 'frontend-app'
            const results = provider.searchProjects('fnt');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].id, 'frontend-app');
        });

        it('ranks exact matches higher than partial matches', () => {
            manager.createTask('auth', 'project'); // Exact match for 'auth'
            const results = provider.searchProjects('auth');

            assert.strictEqual(results[0].id, 'auth');
            assert.strictEqual(results[1].id, 'auth-service');
        });

        it('ranks by recency when scores are equal', async () => {
            manager.createTask('test-a', 'project');
            await new Promise(resolve => setTimeout(resolve, 5));
            manager.createTask('test-b', 'project');

            const results = provider.searchProjects('test');
            // Both start with 'test', so score is same. 'test-b' is more recent.
            assert.strictEqual(results[0].id, 'test-b');
            assert.strictEqual(results[1].id, 'test-a');
        });

        it('returns empty array when no projects match', () => {
            const results = provider.searchProjects('non-existent');
            assert.deepStrictEqual(results, []);
        });

        it('only searches projects, not tasks', () => {
            manager.createTask('my-cool-project', 'project');
            manager.createTask('search-target-task', 'task'); // This should be ignored

            const results = provider.searchProjects('search-target');
            assert.deepStrictEqual(results, []);

            const results2 = provider.searchProjects('cool');
            assert.strictEqual(results2.length, 1);
            assert.strictEqual(results2[0].id, 'my-cool-project');
        });
    });
});
