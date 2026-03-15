/**
 * MCP tool registrations for artifact management.
 *
 * Registers 5 tools against the shared `server` instance:
 *   - list_artifacts
 *   - get_artifact
 *   - update_artifact
 *   - list_artifact_types
 *   - register_artifact_type
 *
 * Handler logic lives in `../handlers/artifactHandlers.ts` for testability.
 * Import this module as a side effect so tool registrations run before
 * the server connects to its transport.
 */

import { z } from 'zod';
import { server } from '../server.js';
import { workspaceRoot, taskManager, artifactService, artifactRegistry } from '../workspaceRoot.js';
import {
    handleListArtifacts,
    handleGetArtifact,
    handleUpdateArtifact,
    handleListArtifactTypes,
    handleRegisterArtifactType,
} from '../handlers/artifactHandlers.js';

server.tool(
    'list_artifacts',
    'List all artifact types for a given task and show whether each artifact file exists on disk. ' +
    '✔ = file saved on disk | ○ = template available, no file yet. ' +
    'If taskId is omitted, the currently active task is used.',
    {
        taskId: z
            .string()
            .optional()
            .describe('ID of the task whose artifacts to list. Defaults to the active task.'),
        parentTaskId: z
            .string()
            .optional()
            .describe('Optional ID of the parent project. Required for subtasks.'),
    },
    ({ taskId, parentTaskId }) => handleListArtifacts(taskManager, artifactService, { taskId, parentTaskId })
);

server.tool(
    'get_artifact',
    'Retrieve the content of a specific artifact for a task. ' +
    'If the artifact file exists on disk its full content is returned. ' +
    'If it does not yet exist, the plain Markdown template body is returned so you can pre-populate it. ' +
    'Use update_artifact to persist changes. ' +
    'If taskId is omitted, the currently active task is used.',
    {
        artifactType: z
            .string()
            .min(1)
            .describe('ID of the artifact type to retrieve (e.g. "research", "walkthrough"). Use list_artifact_types to discover available IDs.'),
        taskId: z
            .string()
            .optional()
            .describe('ID of the task the artifact belongs to. Defaults to the active task.'),
        parentTaskId: z
            .string()
            .optional()
            .describe('Optional ID of the parent project. Required for subtasks.'),
    },
    ({ artifactType, taskId, parentTaskId }) => handleGetArtifact(taskManager, artifactService, { artifactType, taskId, parentTaskId })
);

server.tool(
    'update_artifact',
    'Create or overwrite an artifact file for a task. ' +
    'Writes the provided Markdown content to .tasks/{taskId}/{filename}. ' +
    'If the file does not yet exist it is created; if it does it is fully replaced. ' +
    'If taskId is omitted, the currently active task is used.',
    {
        artifactType: z
            .string()
            .min(1)
            .describe('ID of the artifact type to create or overwrite (e.g. "research"). Use list_artifact_types to discover valid IDs.'),
        content: z
            .string()
            .describe('Full Markdown content for the artifact (no YAML frontmatter). This completely replaces any existing file content.'),
        taskId: z
            .string()
            .optional()
            .describe('ID of the task the artifact belongs to. Defaults to the active task.'),
        parentTaskId: z
            .string()
            .optional()
            .describe('Optional ID of the parent project. Required for subtasks.'),
    },
    ({ artifactType, content, taskId, parentTaskId }) => handleUpdateArtifact(taskManager, artifactService, { artifactType, content, taskId, parentTaskId })
);

server.tool(
    'list_artifact_types',
    'List all registered artifact types, including built-in and any custom types. ' +
    'Returns each type\'s id, displayName, description, and expected filename. ' +
    'Use this to discover which IDs are valid for get_artifact, update_artifact, and register_artifact_type.',
    {},
    () => handleListArtifactTypes(artifactRegistry)
);

server.tool(
    'register_artifact_type',
    'Register a new custom artifact type. ' +
    'The type is persisted to .tasks/templates/{id}.ai.md in the workspace root ' +
    'and is immediately available in-memory. ' +
    'Use this when the standard built-in types do not cover a required document format. ' +
    'Built-in types: research, walkthrough, task-details, review, implementation-plan.',
    {
        id: z
            .string()
            .min(1)
            .describe('Unique identifier for the new artifact type (e.g. "sprint-retro"). Must be URL-friendly (lowercase, hyphens). Determines the filename: {id}.ai.md.'),
        displayName: z
            .string()
            .min(1)
            .describe('Human-friendly display name shown in listings (e.g. "Sprint Retrospective").'),
        description: z
            .string()
            .min(1)
            .describe('Short description of what this artifact type should contain. Used to decide when to use this type.'),
        templateBody: z
            .string()
            .optional()
            .describe('Optional Markdown body to use as the default template. When omitted, an empty template is used.'),
    },
    ({ id, displayName, description, templateBody }) =>
        handleRegisterArtifactType(workspaceRoot, artifactRegistry, { id, displayName, description, templateBody })
);
