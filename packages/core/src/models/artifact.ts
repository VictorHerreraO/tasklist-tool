/**
 * Describes a registered artifact type, including its display metadata,
 * the filename it generates, and its Markdown template body.
 */
export interface ArtifactType {
    /** Unique identifier for this artifact type (e.g. `'research'`). */
    id: string;

    /** Human-friendly name shown in UIs and listings (e.g. `'Research Notes'`). */
    displayName: string;

    /** Short description of what this artifact should contain. */
    description: string;

    /**
     * The `.ai.md` filename that will be written inside a task directory
     * (e.g. `'research.ai.md'`).
     */
    filename: string;

    /**
     * The plain Markdown body used as the default template when an artifact
     * does not yet exist. Must **not** contain YAML frontmatter.
     */
    templateBody: string;
}

/**
 * Represents a resolved artifact file reference for a specific task.
 */
export interface ArtifactInfo {
    /** The registered type that this artifact belongs to. */
    type: ArtifactType;

    /** Absolute path to the artifact file on disk. */
    path: string;

    /** Whether the artifact file currently exists on disk. */
    exists: boolean;
}
