---
agent: Agent_AdHoc_Debug
task_ref: Ad-Hoc - Fix VSCE Packaging in Monorepo
status: Completed
ad_hoc_delegation: true
compatibility_issues: false
important_findings: true
---

# Task Log: Ad-Hoc - Fix VSCE Packaging in Monorepo

## Summary
Fixed the `EISDIR` crash during `vsce package` by implementing `esbuild` bundling for the extension and configuring `.vscodeignore` to exclude redundant files and monorepo root traversal.

## Details
- **Analyzed root cause:** `vsce` was inadvertently traversing into the monorepo root (specifically `.vscode-test/` and other packages) due to workspace symlinks and lack of explicit boundaries, leading to an `EISDIR` error in the secret scanner.
- **Implemented Bundling:** Integrated `esbuild` into the extension's build pipeline. This bundles `@tasklist/core` and other production dependencies into a single `out/extension.js` file.
- **Configured Boundaries:** 
  - Created `.vscodeignore` to aggressively exclude `src/`, `node_modules/`, `tsconfig.json`, and redundant tool files in `out/tools/`.
  - Updated `package.json` with a `bundle` script and modified `package` script to use `--no-dependencies` (since they are now bundled).
- **Validation:** Successfully ran `npm run package` from the root, producing a minimal (4-file, ~33KB) `.vsix` in `packages/extension/`.

## Output
- Modified `packages/extension/package.json`: Added `bundle` script, updated `vscode:prepublish`, added `esbuild` to `devDependencies`, and added `repository` field.
- Created a symbolic link for `LICENSE` in `packages/extension/LICENSE` pointing to the root `LICENSE` to maintain a single source of truth.
- Updated `packages/extension/.vscodeignore`: Excluded all non-runtime files and parent directory traversal.
- Successful build: `packages/extension/tasklist-tool-0.0.1.vsix` with no manifest warnings.

## Issues
None

## Ad-Hoc Agent Delegation
This task was performed via ad-hoc delegation to Agent_AdHoc_Debug.

## Important Findings
In NPM/Yarn workspaces monorepos, `vsce` often struggles with hoisted `node_modules` and symlinks. Bundling with `esbuild` or `webpack` is the most reliable way to ensure a clean extension package and avoid `EISDIR` or massive file count warnings.

## Next Steps
None
