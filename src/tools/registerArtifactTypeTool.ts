import * as vscode from 'vscode';
import { ArtifactRegistry } from '../services/artifactRegistry.js';
import { ArtifactType } from '../models/artifact.js';
import { IRegisterArtifactTypeParams } from './interfaces.js';

/**
 * Language model tool that registers a new custom artifact type.
 *
 * The type is persisted to `.tasks/templates/{id}.ai.md` in the workspace root
 * and is immediately available in-memory via `ArtifactRegistry.getType()`.
 *
 * Use this tool when the standard built-in types (`research`, `walkthrough`,
 * `task-details`, `review`, `implementation-plan`) do not cover a required
 * document format.
 *
 * Implements `vscode.LanguageModelTool<IRegisterArtifactTypeParams>`.
 */
export class RegisterArtifactTypeTool
    implements vscode.LanguageModelTool<IRegisterArtifactTypeParams> {
    /** Absolute path to the VS Code workspace root. */
    private readonly workspaceRoot: string;

    /** The registry to persist and register the new type in. */
    private readonly registry: ArtifactRegistry;

    /**
     * @param workspaceRoot - Absolute path to the VS Code workspace root. Used
     *   to resolve the `.tasks/templates/` directory for the file write.
     * @param registry - The initialized `ArtifactRegistry` for this workspace.
     */
    constructor(workspaceRoot: string, registry: ArtifactRegistry) {
        this.workspaceRoot = workspaceRoot;
        this.registry = registry;
    }

    /**
     * Returns a confirmation message shown to the user before the tool runs.
     *
     * @param options - Invocation prepare options including the raw input.
     * @param _token - Cancellation token (unused here).
     * @returns Confirmation metadata for the VS Code tool-calling UI.
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IRegisterArtifactTypeParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        const { id, displayName } = options.input;
        return {
            invocationMessage: `Registering artifact type '${id}'`,
            confirmationMessages: {
                title: 'Register Artifact Type',
                message: new vscode.MarkdownString(
                    `Create and persist a new artifact type:\n\n` +
                    `- **ID:** \`${id}\`\n` +
                    `- **Display Name:** ${displayName}\n\n` +
                    `A template file \`${id}.ai.md\` will be written to \`.tasks/templates/\`.`
                ),
            },
        };
    }

    /**
     * Invokes the tool: validates the input, builds the {@link ArtifactType}
     * object, and calls `ArtifactRegistry.registerAndPersistType()`.
     *
     * @param options - Invocation options containing the validated input.
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` confirming the registered type's ID
     *   and the filename that was written.
     * @throws {Error} If `id`, `displayName`, or `description` are empty, or if
     *   the file system write fails.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IRegisterArtifactTypeParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { id, displayName, description, templateBody } = options.input;

        // Early validation — all three required fields must be non-empty.
        if (!id || id.trim() === '') {
            throw new Error(
                'A non-empty `id` is required for the artifact type (e.g. `sprint-retro`). ' +
                'Use a URL-friendly, lowercase identifier.'
            );
        }
        if (!displayName || displayName.trim() === '') {
            throw new Error('A non-empty `displayName` is required (e.g. `Sprint Retrospective`).');
        }
        if (!description || description.trim() === '') {
            throw new Error('A non-empty `description` is required to help the LLM know when to use this type.');
        }

        const filename = `${id}.ai.md`;
        const newType: ArtifactType = {
            id,
            displayName,
            description,
            filename,
            templateBody: templateBody ?? '',
        };

        try {
            this.registry.registerAndPersistType(this.workspaceRoot, newType);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `Artifact type '${id}' registered successfully.\n` +
                    `Template file: .tasks/templates/${filename}`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(
                `Failed to register artifact type '${id}': ${message}. ` +
                `Ensure the workspace root is writable and the id is a valid identifier.`
            );
        }
    }
}
