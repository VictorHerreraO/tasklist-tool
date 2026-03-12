# Task 3.3 - Artifact Path Resolution Update

## Overview
Implementation of hierarchical path resolution for artifacts to support the nested filesystem structure. Subtask artifacts are now stored in `.tasks/${projectId}/${subtaskId}/` while top-level project artifacts remain in `.tasks/${projectId}/`.

## Changes implemented
- **TaskManager.ts**:
    - Changed `findEntryGlobally(id)` access modifier from `private` to `public` to allow `ArtifactService` to inspect task hierarchy.
- **ArtifactService.ts**:
    - Updated `taskDir(taskId)` to use `taskManager.findEntryGlobally(taskId)`.
    - If a task has a `parentTaskId`, the path resolves to `.tasks/${parentTaskId}/${taskId}/`.
    - Otherwise, it resolves to `.tasks/${taskId}/`.
- **artifactService.test.ts**:
    - Added a new test suite "Hierarchical Path Resolution" verifying:
        - Subtask artifacts are nested correctly on disk.
        - Top-level project artifacts remain at the root of `.tasks/`.
        - `listArtifacts` and `getArtifact` work correctly with the new structure.

## Verification results
- All 76 tests passed successfully.
- Verified that subtask artifacts are correctly nested: `.tasks/my-project/my-subtask/research.ai.md`.
- Verified that top-level project artifacts remain in: `.tasks/my-project/task-details.ai.md`.

## Lessons Learned / Discoveries
- Exposing `findEntryGlobally` was necessary because `ArtifactService` needs to know the parent task ID to determine the absolute filesystem path for artifacts.
- Maintaining the flat path for top-level tasks ensures compatibility with the existing promotion logic and root-level tasks.
