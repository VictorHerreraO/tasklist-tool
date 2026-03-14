import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TaskManager } from '../services/taskManager.js';
import { ArtifactService } from '../services/artifactService.js';
import { ArtifactRegistry } from '../services/artifactRegistry.js';
import { TaskStatus } from '../models/task.js';

describe('Hierarchy Integration Suite', () => {
    let workspaceRoot: string;
    let taskManager: TaskManager;
    let artifactRegistry: ArtifactRegistry;
    let artifactService: ArtifactService;

    // Use current package root for Registry extensionRoot
    const packageRoot = path.resolve(process.cwd());

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tasklist-hierarchy-test-'));
        taskManager = new TaskManager(workspaceRoot);
        artifactRegistry = new ArtifactRegistry(packageRoot, workspaceRoot);
        artifactRegistry.initialize();
        artifactService = new ArtifactService(workspaceRoot, taskManager, artifactRegistry);
    });

    afterEach(() => {
        if (fs.existsSync(workspaceRoot)) {
            fs.rmSync(workspaceRoot, { recursive: true, force: true });
        }
    });

    describe('Project Promotion', () => {
        it('should promote a standard task to a project', () => {
            const taskId = 'test-proj';
            taskManager.createTask(taskId);

            const entry = taskManager.promoteTaskToProject(taskId);

            expect(entry.type).to.equal('project');

            const projectDir = path.join(workspaceRoot, '.tasks', taskId);
            const indexFile = path.join(projectDir, 'index.json');

            expect(fs.existsSync(projectDir)).to.be.true;
            expect(fs.existsSync(indexFile)).to.be.true;

            const indexContent = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
            expect(indexContent.tasks).to.be.an('array').that.is.empty;
            expect(indexContent.activeTaskId).to.be.null;
        });

        it('should reflect the updated task type in the root index', () => {
            const taskId = 'test-proj';
            taskManager.createTask(taskId);
            taskManager.promoteTaskToProject(taskId);

            const rootIndexFile = path.join(workspaceRoot, '.tasks', 'index.json');
            const rootIndexContent = JSON.parse(fs.readFileSync(rootIndexFile, 'utf-8'));
            const task = rootIndexContent.tasks.find((t: any) => t.id === taskId);
            expect(task.type).to.equal('project');
        });
    });

    describe('Subtask Management', () => {
        const projectId = 'parent-proj';

        beforeEach(() => {
            taskManager.createTask(projectId, 'project');
        });

        it('should create subtasks within a project', () => {
            const subtaskId = 'child-task';
            const entry = taskManager.createTask(subtaskId, 'task', projectId);

            expect(entry.id).to.equal(subtaskId);
            expect(entry.parentTaskId).to.equal(projectId);

            const nestedIndexFile = path.join(workspaceRoot, '.tasks', projectId, 'index.json');
            const nestedIndexContent = JSON.parse(fs.readFileSync(nestedIndexFile, 'utf-8'));
            expect(nestedIndexContent.tasks).to.have.lengthOf(1);
            expect(nestedIndexContent.tasks[0].id).to.equal(subtaskId);
        });

        it('should list only top-level tasks by default in listTasks()', () => {
            taskManager.createTask('top-task');
            taskManager.createTask('sub-task', 'task', projectId);

            const tasks = taskManager.listTasks();
            const ids = tasks.map(t => t.id);

            expect(ids).to.include('top-task');
            expect(ids).to.include(projectId);
            expect(ids).to.not.include('sub-task');
        });

        it('should list subtasks when parentTaskIdFilter is provided', () => {
            taskManager.createTask('sub-1', 'task', projectId);
            taskManager.createTask('sub-2', 'task', projectId);

            const subtasks = taskManager.listTasks(undefined, projectId);
            const ids = subtasks.map(t => t.id);

            expect(ids).to.have.members(['sub-1', 'sub-2']);
        });

        it('should NOT return subtasks in a root listTasks() call by default', () => {
            taskManager.createTask('sub-x', 'task', projectId);
            const rootTasks = taskManager.listTasks();
            expect(rootTasks.find(t => t.id === 'sub-x')).to.be.undefined;
        });
    });

    describe('Cross-Index State Transitions', () => {
        const projectId = 'parent-proj';
        const subtaskId = 'child-task';

        beforeEach(() => {
            taskManager.createTask(projectId, 'project');
            taskManager.createTask(subtaskId, 'task', projectId);
        });

        it('should require parentTaskId to start and close a subtask', () => {
            // Start fails without parentTaskId
            expect(() => taskManager.start_task(subtaskId)).to.throw(/Task 'child-task' not found\./);

            // Start succeeds with parentTaskId
            const startEntry = taskManager.start_task(subtaskId, projectId);
            expect(startEntry.status).to.equal(TaskStatus.InProgress);

            // Close fails without parentTaskId
            expect(() => taskManager.close_task(subtaskId)).to.throw(/Task 'child-task' not found\./);

            // Close succeeds with parentTaskId
            const closeEntry = taskManager.close_task(subtaskId, projectId);
            expect(closeEntry.status).to.equal(TaskStatus.Closed);
        });

        it('should require parentTaskId to activate a subtask', () => {
            expect(() => taskManager.activateTask(subtaskId)).to.throw(/Cannot activate task 'child-task': task not found\./);

            taskManager.activateTask(subtaskId, projectId);
            const active = taskManager.getActiveTask();

            expect(active).to.not.be.null;
            expect(active?.id).to.equal(subtaskId);
        });

        it('should correctly identify an active subtask regardless of its location (recursively)', () => {
            taskManager.activateTask(subtaskId, projectId);

            // New manager instance to ensure persistence
            const newManager = new TaskManager(workspaceRoot);
            const active = newManager.getActiveTask();

            expect(active).to.not.be.null;
            expect(active?.id).to.equal(subtaskId);
            expect(active?.parentTaskId).to.equal(projectId);
        });
    });

    describe('Hierarchical Artifacts', () => {
        const projectId = 'parent-proj';
        const subtaskId = 'child-task';

        beforeEach(() => {
            taskManager.createTask(projectId, 'project');
            taskManager.createTask(subtaskId, 'task', projectId);
        });

        it('should require parentTaskId to create artifacts for a subtask if not found in root', () => {
            const content = '# Subtask Research';
            // Current findEntryGlobally in updateArtifact should search using parentTaskId
            // If parentTaskId is missing, it only searches root.
            expect(() => artifactService.updateArtifact(subtaskId, 'research', content)).to.throw(/Task 'child-task' not found\./);

            artifactService.updateArtifact(subtaskId, 'research', content, projectId);

            const expectedPath = path.join(workspaceRoot, '.tasks', projectId, subtaskId, 'research.ai.md');
            expect(fs.existsSync(expectedPath)).to.be.true;
            expect(fs.readFileSync(expectedPath, 'utf-8')).to.equal(content);
        });

        it('should require parentTaskId to list and locate artifacts in nested structure', () => {
            artifactService.updateArtifact(subtaskId, 'research', '# Research', projectId);

            expect(() => artifactService.listArtifacts(subtaskId)).to.throw(/Task 'child-task' not found\./);

            const artifacts = artifactService.listArtifacts(subtaskId, projectId);
            const research = artifacts.find(a => a.type.id === 'research');

            expect(research).to.not.be.undefined;
            expect(research?.exists).to.be.true;
            expect(research?.path).to.contain(path.join('.tasks', projectId, subtaskId));
        });
    });

    describe('Recursive Cleanup Simulation', () => {
        it('should handle nested .tasks subdirectories correctly during cleanup', () => {
            const p1 = 'proj-1';
            const s1 = 'sub-1';
            taskManager.createTask(p1, 'project');
            taskManager.createTask(s1, 'task', p1);
            artifactService.updateArtifact(s1, 'research', '# Content', p1);

            const tasksPath = path.join(workspaceRoot, '.tasks');
            expect(fs.existsSync(tasksPath)).to.be.true;

            // Verify structure exists before "cleanup"
            const subtaskArtifactPath = path.join(tasksPath, p1, s1, 'research.ai.md');
            expect(fs.existsSync(subtaskArtifactPath)).to.be.true;

            // Simulate workspace cleanup (standard fs removal)
            // This verifies that our structure doesn't cause issues for standard recursive removal
            expect(() => fs.rmSync(tasksPath, { recursive: true, force: true })).to.not.throw();
            expect(fs.existsSync(tasksPath)).to.be.false;
        });
    });
});
