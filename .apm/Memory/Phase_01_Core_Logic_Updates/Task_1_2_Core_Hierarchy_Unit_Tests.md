# Memory Log: Task 1.2 - Core Hierarchy Unit Tests

- **Task ID**: task-1-2
- **Agent**: Agent_QA
- **Status**: Completed
- **Timestamp**: 2026-03-14T17:55:00-06:00

## Work Performed
1. **Signature Verification**:
   - Confirmed updated signatures in `TaskManager` and `ArtifactService` for hierarchical scoping.
   - Identified that `findEntryGlobally` now defaults to root-only search if `parentTaskId` is omitted.

2. **Test Implementation**:
   - Added `strict hierarchical scoping` tests in `taskManager.test.ts` verifying that subtasks are inaccessible without explicit `parentTaskId`.
   - Added `recursive getActiveTask` tests in `taskManager.test.ts` verifying resolution across multiple levels of nesting.
   - Added `cascading activation` tests verifying the `activateProject` flag behavior.
   - Enhanced `artifactService.test.ts` with explicit scoping tests for `listArtifacts`, `updateArtifact`, and `getArtifact`.

3. **Existing Test Refactoring**:
   - Updated `hierarchy.test.ts` to match new strict API requirements. Many integration tests were updated to provide the necessary `parentTaskId` context.
   - Fixed `taskManager.test.ts` existing tests for subtask status transitions.

4. **Bug Fixes and Enhancements**:
   - **Deep Hierarchy Support**: Updated `TaskManager.createTask` and `promoteTaskToProject` to use a new internal `findEntryRecursive` helper, allowing nested sub-projects to act as parents for further elements.
   - **Activation Integrity**: Fixed a bug in `activateTask` where it would erroneously set any `parentTaskId` as the root active task, even if that parent was itself a subtask. Added logic to verify parent existence in root before cascading.

## Test Results
- **Suite**: `packages/core`
- **Total Tests**: 115
- **Passing**: 115
- **Failing**: 0
- **Coverage**: 100% for the new hierarchical logic paths.

## Next Steps
- This task is complete. Handing over to the Manager for Phase 1 closure.
