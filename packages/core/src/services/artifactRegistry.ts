import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ArtifactType } from '../models/artifact.js';

/** Shape expected in the YAML frontmatter of each `.ai.md` template file. */
interface TemplateFrontmatter {
    id: string;
    displayName: string;
    description: string;
    filename: string;
}

/**
 * Parses a `.ai.md` template file and returns an `ArtifactType`.
 *
 * The file format is:
 * ```
 * ---
 * id: ...
 * displayName: ...
 * description: ...
 * filename: ...
 * ---
 * <Markdown body — becomes templateBody>
 * ```
 *
 * @param filePath - Absolute path to the `.ai.md` template file.
 * @throws {Error} If the file does not contain valid YAML frontmatter.
 */
function parseTemplateFile(filePath: string): ArtifactType {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Split on the frontmatter delimiters.
    // Expected format: "---\n<yaml>\n---\n<body>"
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        throw new Error(`Template file "${filePath}" is missing valid YAML frontmatter.`);
    }

    const frontmatter = yaml.load(match[1]) as TemplateFrontmatter;
    if (!frontmatter?.id || !frontmatter?.displayName || !frontmatter?.description || !frontmatter?.filename) {
        throw new Error(
            `Template file "${filePath}" frontmatter is missing required fields (id, displayName, description, filename).`
        );
    }

    const templateBody = match[2].trimEnd();

    return {
        id: frontmatter.id,
        displayName: frontmatter.displayName,
        description: frontmatter.description,
        filename: frontmatter.filename,
        templateBody,
    };
}

/**
 * Serialises an `ArtifactType` back into `.ai.md` file content
 * (frontmatter + body), suitable for persisting to disk.
 */
function serializeTemplateFile(type: ArtifactType): string {
    const frontmatter = yaml.dump({
        id: type.id,
        displayName: type.displayName,
        description: type.description,
        filename: type.filename,
    }).trimEnd();
    return `---\n${frontmatter}\n---\n${type.templateBody}\n`;
}

/**
 * Loads all `.ai.md` template files from a directory.
 * Non-matching files are silently skipped.
 *
 * @param dir - Absolute path to the directory to scan.
 */
function loadTemplatesFromDir(dir: string): ArtifactType[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const types: ArtifactType[] = [];
    for (const entry of fs.readdirSync(dir)) {
        if (!entry.endsWith('.ai.md')) {
            continue;
        }
        const filePath = path.join(dir, entry);
        try {
            types.push(parseTemplateFile(filePath));
        } catch {
            // Skip malformed template files gracefully.
        }
    }
    return types;
}

// ─── ArtifactRegistry ────────────────────────────────────────────────────────

/**
 * Two-tier artifact type registry.
 *
 * Tier 1 – **built-in** types bundled with the extension (`src/templates/`).
 * Tier 2 – **workspace-level** custom types persisted to `.tasks/templates/`.
 *
 * Workspace types are loaded on `initialize()` and override built-ins that
 * share the same `id`.
 */
export class ArtifactRegistry {
    /** Absolute path to the extension root (where `src/templates/` lives). */
    private readonly extensionRoot: string;

    /** Absolute path to the workspace root (where `.tasks/templates/` lives). */
    private readonly workspaceRoot: string;

    /** In-memory store of all registered artifact types, keyed by `id`. */
    private readonly _types: Map<string, ArtifactType> = new Map();

    /**
     * @param extensionRoot - Absolute path to the bundled extension root.
     * @param workspaceRoot - Absolute path to the VS Code workspace root folder.
     */
    constructor(extensionRoot: string, workspaceRoot: string) {
        this.extensionRoot = extensionRoot;
        this.workspaceRoot = workspaceRoot;
    }

    // ── Initialisation ───────────────────────────────────────────────────────

    /**
     * Loads and registers all template definitions.
     *
     * 1. Parses built-in templates from `extensionRoot/src/templates/`.
     * 2. Parses workspace-level templates from `workspaceRoot/.tasks/templates/`
     *    (if the directory exists). Workspace templates **override** built-ins
     *    that share the same `id`.
     *
     * Safe to call multiple times — re-initialization replaces the registry.
     */
    initialize(): void {
        this._types.clear();

        // Tier 1: built-in bundled templates.
        const builtInDir = path.join(__dirname, '..', 'templates');
        for (const type of loadTemplatesFromDir(builtInDir)) {
            this._types.set(type.id, type);
        }

        // Tier 2: workspace-level custom templates (may override built-ins).
        const workspaceTemplatesDir = path.join(this.workspaceRoot, '.tasks', 'templates');
        for (const type of loadTemplatesFromDir(workspaceTemplatesDir)) {
            this._types.set(type.id, type);
        }
    }

    // ── Read Operations ──────────────────────────────────────────────────────

    /**
     * Returns all currently registered artifact types.
     */
    getTypes(): ArtifactType[] {
        return Array.from(this._types.values());
    }

    /**
     * Returns the artifact type for the given `id`.
     *
     * @param id - The artifact type identifier.
     * @throws {Error} If no type with `id` has been registered.
     */
    getType(id: string): ArtifactType {
        const type = this._types.get(id);
        if (!type) {
            throw new Error(
                `Unknown artifact type '${id}'. Use 'list_artifact_types' to see available types.`
            );
        }
        return type;
    }

    /**
     * Returns the output filename for a given type ID.
     *
     * @param typeId - The artifact type identifier.
     * @throws {Error} If the type is not registered.
     */
    getFilename(typeId: string): string {
        return this.getType(typeId).filename;
    }

    /**
     * Returns the plain Markdown template body for a given type ID.
     * The returned string **never** contains YAML frontmatter.
     *
     * @param typeId - The artifact type identifier.
     * @throws {Error} If the type is not registered.
     */
    getTemplate(typeId: string): string {
        return this.getType(typeId).templateBody;
    }

    // ── Write Operations ─────────────────────────────────────────────────────

    /**
     * Registers an artifact type in memory (does not persist to disk).
     *
     * If a type with the same `id` already exists it will be overwritten.
     *
     * @param type - The artifact type to register.
     */
    registerType(type: ArtifactType): void {
        this._types.set(type.id, type);
    }

    /**
     * Persists a new artifact type as a `.ai.md` file in
     * `workspaceRoot/.tasks/templates/` then registers it in memory.
     *
     * The `.tasks/templates/` directory is created lazily if it does not exist.
     * If a workspace template file with the same `id` already exists, it is
     * overwritten.
     *
     * @param workspaceRoot - Absolute path to the workspace root (may differ
     *   from `this.workspaceRoot` when called from a tool handler).
     * @param type - The artifact type to persist and register.
     */
    registerAndPersistType(workspaceRoot: string, type: ArtifactType): void {
        const templatesDir = path.join(workspaceRoot, '.tasks', 'templates');
        if (!fs.existsSync(templatesDir)) {
            fs.mkdirSync(templatesDir, { recursive: true });
        }
        const filePath = path.join(templatesDir, `${type.id}.ai.md`);
        fs.writeFileSync(filePath, serializeTemplateFile(type), 'utf-8');
        this.registerType(type);
    }
}
