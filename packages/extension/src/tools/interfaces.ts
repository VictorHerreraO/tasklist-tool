/**
 * Input parameter interfaces for the task management LM tools.
 *
 * These interfaces mirror the JSON schemas declared in `package.json`
 * under `contributes.languageModelTools[*].inputSchema` and are used
 * as generics for `vscode.LanguageModelTool<T>`.
 */

/**
 * Parameters for the `list_tasks` tool.
 */
export interface IListTasksParams {
    /**
     * Optional status filter. When provided, only tasks with this status are
     * returned. Accepted values: `'open'`, `'in-progress'`, `'closed'`.
     * Omit to list all tasks.
     */
    status?: string;
}

/**
 * Parameters for the `create_task` tool.
 */
export interface ICreateTaskParams {
    /**
     * Unique, URL-friendly identifier for the new task
     * (e.g. `'feature-login'`). Must not already exist in the workspace.
     */
    taskId: string;
}

/**
 * Generic parameters for tools that operate on a single task by its ID.
 *
 * Reused for: `activate_task`, `deactivate_task`, `start_task`, `close_task`.
 * (`deactivate_task` does not actually need a taskId but we keep the shape
 * consistent so the LM can still pass it without causing an error.)
 */
export interface ITaskIdParams {
    /**
     * The unique identifier of the task to operate on
     * (e.g. `'feature-login'`).
     */
    taskId: string;
}

// ─── Artifact Tool Interfaces ────────────────────────────────────────────────

/**
 * Parameters for the `list_artifacts` tool.
 */
export interface IListArtifactsParams {
    /**
     * ID of the task whose artifacts to list.
     * When omitted, the tool falls back to the currently active task.
     */
    taskId?: string;
}

/**
 * Parameters for the `get_artifact` tool.
 */
export interface IGetArtifactParams {
    /**
     * ID of the artifact type to retrieve (e.g. `'research'`, `'walkthrough'`).
     * Use `list_artifact_types` to discover available type IDs.
     */
    artifactType: string;

    /**
     * ID of the task the artifact belongs to.
     * When omitted, the tool falls back to the currently active task.
     */
    taskId?: string;
}

/**
 * Parameters for the `update_artifact` tool.
 */
export interface IUpdateArtifactParams {
    /**
     * ID of the artifact type to create or overwrite (e.g. `'research'`).
     * Use `list_artifact_types` to discover available type IDs.
     */
    artifactType: string;

    /**
     * Full Markdown content for the artifact (no YAML frontmatter).
     * This completely replaces any existing file content.
     */
    content: string;

    /**
     * ID of the task the artifact belongs to.
     * When omitted, the tool falls back to the currently active task.
     */
    taskId?: string;
}

/**
 * Parameters for the `register_artifact_type` tool.
 */
export interface IRegisterArtifactTypeParams {
    /**
     * Unique identifier for the new artifact type (e.g. `'sprint-retro'`).
     * Must be URL-friendly (lowercase, hyphens). Will also determine the
     * filename: `{id}.ai.md`.
     */
    id: string;

    /**
     * Human-friendly display name shown in listings (e.g. `'Sprint Retrospective'`).
     */
    displayName: string;

    /**
     * Short description of what this artifact type should contain.
     * Used by the LLM to decide when to use this type.
     */
    description: string;

    /**
     * Optional Markdown body to use as the default template.
     * When omitted, an empty template is used.
     */
    templateBody?: string;
}
