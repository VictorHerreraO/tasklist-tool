import * as vscode from 'vscode';
import { ArtifactRegistry } from '../services/artifactRegistry.js';

/**
 * Language model tool that lists all registered artifact types.
 *
 * Returns every type currently loaded in the {@link ArtifactRegistry}, along
 * with its `id`, `displayName`, `description`, and expected `filename`. The
 * output helps an agent decide which artifact type to pass to `get_artifact`,
 * `update_artifact`, or `register_artifact_type`.
 *
 * This tool takes no input parameters.
 *
 * Implements `vscode.LanguageModelTool<Record<string, never>>`.
 */
export class ListArtifactTypesTool implements vscode.LanguageModelTool<Record<string, never>> {
    /** The registry that holds all registered artifact type definitions. */
    private readonly registry: ArtifactRegistry;

    /**
     * @param registry - The initialized `ArtifactRegistry` for this workspace.
     */
    constructor(registry: ArtifactRegistry) {
        this.registry = registry;
    }

    /**
     * Returns a confirmation message shown to the user before the tool runs.
     *
     * @param _options - Invocation prepare options (no input fields used).
     * @param _token - Cancellation token (unused here).
     * @returns Confirmation metadata for the VS Code tool-calling UI.
     */
    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<Record<string, never>>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Listing all registered artifact types',
            confirmationMessages: {
                title: 'List Artifact Types',
                message: new vscode.MarkdownString(
                    'Retrieve all artifact types registered in this workspace, ' +
                    'including built-in and any custom types.'
                ),
            },
        };
    }

    /**
     * Invokes the tool: reads all registered artifact types and returns a
     * formatted summary.
     *
     * @param _options - Invocation options (no input used).
     * @param _token - Cancellation token (unused here).
     * @returns A `LanguageModelToolResult` listing each type's id, displayName,
     *   description, and filename.
     * @throws {Error} If the registry is unexpectedly unavailable.
     */
    async invoke(
        _options: vscode.LanguageModelToolInvocationOptions<Record<string, never>>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const types = this.registry.getTypes();

            if (types.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        'No artifact types are currently registered. ' +
                        'Use `register_artifact_type` to add a custom type.'
                    ),
                ]);
            }

            const lines = types.map(
                t =>
                    `- **${t.id}** (${t.filename})\n` +
                    `  Display name: ${t.displayName}\n` +
                    `  Description:  ${t.description}`
            );

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `${types.length} artifact type(s) registered:\n\n${lines.join('\n\n')}`
                ),
            ]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(
                `Failed to list artifact types: ${message}. ` +
                `Ensure the registry has been initialized and try again.`
            );
        }
    }
}
