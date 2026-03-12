# Task Log: Relocate TaskManager Tests

## Context
- **Task ID**: 1.2
- **Agent**: Agent_Core
- **Phase**: 01 - Test Infrastructure Baseline

## Actions Taken
- **Infrastructure Alignment**: Added `"type": "module"` to `packages/core/package.json` to support `NodeNext` resolution and `.js` extensions used in the core source code.
- **Relocation**: Moved `TaskManager` tests from `packages/extension/src/test/services/taskManager.test.ts` to `packages/core/src/test/taskManager.test.ts`.
- **Refactoring**:
    - Converted tests from TDD interface (`suite`/`test`) to BDD interface (`describe`/`it`) to match the core package's test patterns.
    - Updated imports to use relative paths (`../services/taskManager.js`) and ensured compliance with ESM requirements.
- **Environment Configuration**:
    - Updated `packages/core/package.json` test script to use `NODE_OPTIONS='--loader ts-node/esm --no-warnings'` for ESM support.
    - Cleaned up `packages/core/.mocharc.json` by removing the legacy `ts-node/register`.
- **Cleanup**: Removed the dummy `packages/core/src/test/initial.test.ts` and the original test file in `packages/extension`.

## Verification
- Ran `npm test` in `packages/core`.
- **Result**: 31 tests passed (all `TaskManager` test cases).

## Challenges & Solutions
- **Module Resolution**: Encountered `MODULE_NOT_FOUND` errors because the core source code used `.js` extensions but the package was not marked as ESM.
- **Solution**: Explicitly enabled ESM in `packages/core` and switched to the `ts-node/esm` loader for the test runner.

## Next Steps
- Core business logic is now fully tested in isolation.
- Proceed with remaining Phase 1 tasks or Phase 2 implementation.
