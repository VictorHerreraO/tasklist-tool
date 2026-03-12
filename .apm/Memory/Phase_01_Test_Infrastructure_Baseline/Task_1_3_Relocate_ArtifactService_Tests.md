---
agent: Agent_Core
task_ref: Task 1.3 - Relocate ArtifactService Tests
status: Completed
ad_hoc_delegation: false
compatibility_issues: false
important_findings: true
---

# Task Log: Task 1.3 - Relocate ArtifactService Tests

## Summary
Relocated and refactored `ArtifactService` tests from the extension package to the core package. Ensured ESM compliance, decoupled logic from VS Code APIs, and fixed critical ESM compatibility issues in `ArtifactRegistry`.

## Details
- **Relocation**: Moved `packages/extension/src/test/services/artifactService.test.ts` to `packages/core/src/test/artifactService.test.ts`.
- **Refactoring**: 
    - Converted tests from TDD (`suite`/`test`) to BDD (`describe`/`it`).
    - Updated imports to use relative paths with `.js` extensions (e.g., `../services/artifactService.js`).
- **ESM Bug Fix**: Fixed a `ReferenceError: __dirname is not defined` in `ArtifactRegistry.ts`. Shimmed `__dirname` using `import.meta.url` to support both `ts-node/esm` and compiled ESM execution.
- **Resource Restoration**: Identified that `research.ai.md` was missing from `packages/core/src/templates` (only existed in `out/`). Copied it back to `src` so `ts-node` can load the built-in type during tests.
- **Verification**: Ran `npm test` in `packages/core`. All 54 tests (including 24 new `ArtifactService` tests) passed successfully.
- **Cleanup**: Deleted the legacy test file in the extension package and temporary debugging scripts.

## Output
- **New File**: `packages/core/src/test/artifactService.test.ts`
- **Modified File**: `packages/core/src/services/artifactRegistry.ts` (Bug fix)
- **Restored File**: `packages/core/src/templates/research.ai.md`
- **Deleted File**: `packages/extension/src/test/services/artifactService.test.ts`

## Issues
None. Initial blockers (ESM compatibility and missing templates) were resolved during the task.

## Important Findings
- **ESM Constraints**: Core logic that relies on `__dirname` (like `ArtifactRegistry`) must be shimmed for ESM when running via `ts-node/esm`.
- **Source Sync**: Discrepancies between `src/templates` and `out/templates` can cause tests to fail when running from source. `research.ai.md` was a notable orphan that needed restoration to `src`.

## Next Steps
None. Test infrastructure for Core services is now relocated and passing.
