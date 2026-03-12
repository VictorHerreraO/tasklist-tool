# Task 5.2 - Implement 'Promote to Project' Command

## Status
- **Date**: 2026-03-12
- **Agent**: Agent_Extension
- **Status**: Completed

## Work Accomplished
- **Command Registration**: Registered `tasklist.promoteToProject` in `packages/extension/src/extension.ts`.
- **Command Handler**: Implemented logic to call `taskManager.promoteTaskToProject(item.id)`, refresh the tree view, and show a success notification.
- **UI Contributions**: 
    - Added the command to `contributes.commands` in `package.json`.
    - Added the command to `contributes.menus` under `view/item/context`.
    - Set the visibility condition to `viewItem == task` within the `tasklist-tree` view.
- **Verification**: 
    - Confirmed `TaskTreeItem` sets `contextValue` to `'task'` for standard tasks.
    - Verified `TaskTreeProvider` has a `refresh()` method that fires `onDidChangeTreeData`.
    - Successfully compiled the extension with `npm run compile`.

## Decisions & Rationale
- **Context Menu Grouping**: Added the command to the `1_modification` group for standard context menu placement and to the `inline` group for quick access via icon (using `$(project)` icon).
- **Error Handling**: Included a try-catch block in the command handler to provide user feedback if promotion fails (e.g., due to file system issues).

## Future Considerations
- **Nested Promotion**: Currently, `TaskManager.promoteTaskToProject` only searches the root index. If nested task promotion is required in the future, the core logic should be updated to use `findEntryGlobally`.
- **UI feedback**: The expansion state of the tree might reset on refresh; if this becomes a UX issue, consider more targeted refresh strategies in `TaskTreeProvider`.
