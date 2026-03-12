import * as fs from 'fs';
import * as path from 'path';
import { ArtifactInfo } from '../models/artifact.js';
import { TaskManager } from './taskManager.js';
import { ArtifactRegistry } from './artifactRegistry.js';

/**
 * File I/O service for artifact files stored in `.tasks/{taskId}/`.
 *
 * Wires together `TaskManager` (for task validation) and `ArtifactRegistry`
 * (for type metadata and template bodies). All filesystem paths are resolved
 * relative to the workspace root supplied at construction time.
 */
export class ArtifactService {
    /** Absolute path to the VS Code workspace root. */
    private readonly workspaceRoot: string;

    /** Used to validate task existence before write operations. */
    private readonly taskManager: TaskManager;

    /** Used to resolve type metadata and template bodies. */
    private readonly artifactRegistry: ArtifactRegistry;

    /**
     * @param workspaceRoot     - Absolute path to the workspace root.
     * @param taskManager       - Initialised TaskManager for this workspace.
     * @param artifactRegistry  - Initialised ArtifactRegistry for this workspace.
     */
    constructor(
        workspaceRoot: string,
        taskManager: TaskManager,
        artifactRegistry: ArtifactRegistry
    ) {
        this.workspaceRoot = workspaceRoot;
        this.taskManager = taskManager;
        this.artifactRegistry = artifactRegistry;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /** Returns the absolute path to the task directory inside `.tasks/`. */
    private taskDir(taskId: string): string {
        const result = this.taskManager.findEntryGlobally(taskId);
        if (result?.parentTaskId) {
            return path.join(this.workspaceRoot, '.tasks', result.parentTaskId, taskId);
        }
        return path.join(this.workspaceRoot, '.tasks', taskId);
    }

    /** Returns the absolute path to a specific artifact file. */
    private artifactPath(taskId: string, filename: string): string {
        return path.join(this.taskDir(taskId), filename);
    }

    /**
     * Throws a descriptive error if `taskId` is not found in the task index.
     * Used to gate write operations against non-existent tasks.
     */
    private assertTaskExists(taskId: string): void {
        if (!this.taskManager.taskExists(taskId)) {
            throw new Error(
                `Task '${taskId}' not found. Use 'create_task' to create it first.`
            );
        }
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Returns an `ArtifactInfo` entry for every registered artifact type,
     * indicating whether each artifact file currently exists on disk for the
     * given task.
     *
     * @param taskId - ID of the task whose artifact directory to inspect.
     * @throws {Error} If `taskId` does not exist in the task index.
     */
    listArtifacts(taskId: string): ArtifactInfo[] {
        this.assertTaskExists(taskId);
        return this.artifactRegistry.getTypes().map(type => {
            const filePath = this.artifactPath(taskId, type.filename);
            return {
                type,
                path: filePath,
                exists: fs.existsSync(filePath),
            };
        });
    }

    /**
     * Returns the content of an artifact file. If the file does not yet exist
     * on disk the plain Markdown template body (no frontmatter) is returned
     * instead, allowing the caller to pre-populate the document.
     *
     * @param taskId - ID of the task the artifact belongs to.
     * @param typeId - ID of the artifact type to read.
     * @throws {Error} If `typeId` is not a registered artifact type.
     */
    getArtifact(taskId: string, typeId: string): string {
        // Let the registry throw first if the type is unknown.
        const type = this.artifactRegistry.getType(typeId);
        const filePath = this.artifactPath(taskId, type.filename);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        return this.artifactRegistry.getTemplate(typeId);
    }

    /**
     * Writes `content` to `.tasks/{taskId}/{filename}`, creating the task
     * directory lazily if it does not yet exist. Any previous file content is
     * fully replaced.
     *
     * @param taskId  - ID of the task the artifact belongs to.
     * @param typeId  - ID of the artifact type to write.
     * @param content - Full Markdown content for the artifact (no frontmatter).
     * @throws {Error} If `taskId` does not exist in the task index.
     * @throws {Error} If `typeId` is not a registered artifact type.
     */
    updateArtifact(taskId: string, typeId: string, content: string): void {
        this.assertTaskExists(taskId);
        // Let the registry throw if the type is unknown.
        const type = this.artifactRegistry.getType(typeId);
        const dir = this.taskDir(taskId);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.artifactPath(taskId, type.filename), content, 'utf-8');
    }
}
