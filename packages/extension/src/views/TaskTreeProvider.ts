import * as vscode from 'vscode';
import { TaskManager, TaskEntry, TaskStatus } from '@tasklist/core';

/**
 * Provides a tree view of hierarchical tasks (Projects and Subtasks).
 */
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private expandedItemIds: Set<string> = new Set();
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> =
        new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    constructor(private taskManager?: TaskManager) { }

    /**
     * Updates the task manager and refreshes the view.
     */
    setTaskManager(taskManager: TaskManager | undefined): void {
        this.taskManager = taskManager;
        this.refresh();
    }

    /**
     * Records the expansion state of a specific item.
     */
    setExpanded(itemId: string, expanded: boolean): void {
        if (expanded) {
            this.expandedItemIds.add(itemId);
        } else {
            this.expandedItemIds.delete(itemId);
        }
    }

    /**
     * Refreshes the tree view data for the entire tree or a specific item.
     */
    refresh(item?: TaskTreeItem): void {
        this._onDidChangeTreeData.fire(item);
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        element.updateIcon();
        return element;
    }

    async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
        if (!this.taskManager) {
            return [];
        }

        const activeTask = this.taskManager.getActiveTask();
        let tasks: TaskEntry[];
        if (element) {
            // Fetch subtasks for the expanded project
            tasks = this.taskManager.listTasks(undefined, element.task.id);
        } else {
            // Fetch top-level projects and tasks
            tasks = this.taskManager.listTasks();
        }

        // Apply folder-like sorting
        this.sortTasks(tasks);

        return tasks.map(task => {
            const isActive = this.isPathActive(task, activeTask);
            const compositeId = (task.parentTaskId ?? 'root') + ':' + task.id;

            // Ensure active path projects are recorded as expanded so they persist
            // even if the active task changes later.
            if (isActive && task.type === 'project') {
                this.expandedItemIds.add(compositeId);
            }

            const isManualExpanded = this.expandedItemIds.has(compositeId);
            const state = task.type === 'project'
                ? (isActive || isManualExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
                : vscode.TreeItemCollapsibleState.None;

            return new TaskTreeItem(task, isActive, state);
        });
    }

    /**
     * Checks if a task is part of the active path (meaning it is either the active task itself, 
     * or a parent project of the active task).
     */
    private isPathActive(task: TaskEntry, activeTask: TaskEntry | null): boolean {
        if (!activeTask) {
            return false;
        }
        if (task.id === activeTask.id && task.parentTaskId === activeTask.parentTaskId) {
            return true;
        }

        // Walk up from the activeTask to see if 'task' is an ancestor
        let currentId = activeTask.parentTaskId;
        while (currentId) {
            if (task.id === currentId) {
                // If the candidate task is a project, check if it matches the currentId
                // Note: project IDs are globally unique for now in this architecture 
                // but we should still be careful.
                return true;
            }
            if (!this.taskManager) {
                break;
            }
            const parentResult = this.taskManager.findEntryGlobally(currentId);
            currentId = parentResult?.entry?.parentTaskId;
        }
        return false;
    }

    /**
     * Sorts tasks folder-style: Projects a-z followed by Tasks a-z.
     */
    private sortTasks(tasks: TaskEntry[]): void {
        tasks.sort((a, b) => {
            // Priority 1: Type (Projects first)
            if (a.type === 'project' && b.type !== 'project') {
                return -1;
            }
            if (a.type !== 'project' && b.type === 'project') {
                return 1;
            }

            // Priority 2: ID (alphabetical natural sort)
            return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    /**
     * Required for treeView.reveal to work. 
     * Returns the parent of the given element.
     */
    async getParent(element: TaskTreeItem): Promise<TaskTreeItem | undefined> {
        if (!this.taskManager || !element.task.parentTaskId) {
            return undefined;
        }

        const parentId = element.task.parentTaskId;
        const result = this.taskManager.findEntryGlobally(parentId);
        if (result) {
            const activeTask = this.taskManager.getActiveTask();
            const isActive = this.isPathActive(result.entry, activeTask);
            const compositeId = (result.entry.parentTaskId ?? 'root') + ':' + result.entry.id;

            // Ensure active path projects are recorded as expanded
            if (isActive && result.entry.type === 'project') {
                this.expandedItemIds.add(compositeId);
            }

            const isManualExpanded = this.expandedItemIds.has(compositeId);
            const state = result.entry.type === 'project'
                ? (isActive || isManualExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
                : vscode.TreeItemCollapsibleState.None;

            return new TaskTreeItem(result.entry, isActive, state);
        }
        return undefined;
    }

    /**
     * Helper to find or create a TaskTreeItem for a specific taskId.
     * Used by the reveal logic to find the entry point.
     */
    async getItemForId(taskId: string, parentTaskId?: string): Promise<TaskTreeItem | undefined> {
        if (!this.taskManager) {
            return undefined;
        }

        const result = this.taskManager.findEntryGlobally(taskId, parentTaskId);
        if (result) {
            const activeTask = this.taskManager.getActiveTask();
            const isActive = this.isPathActive(result.entry, activeTask);
            const compositeId = (result.entry.parentTaskId ?? 'root') + ':' + result.entry.id;

            // Ensure active path projects are recorded as expanded
            if (isActive && result.entry.type === 'project') {
                this.expandedItemIds.add(compositeId);
            }

            const isManualExpanded = this.expandedItemIds.has(compositeId);
            const state = result.entry.type === 'project'
                ? (isActive || isManualExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
                : vscode.TreeItemCollapsibleState.None;

            return new TaskTreeItem(result.entry, isActive, state);
        }
        return undefined;
    }
}

/**
 * Represents a task or project in the tree view.
 */
export class TaskTreeItem extends vscode.TreeItem {
    constructor(
        public readonly task: TaskEntry,
        public readonly isActive: boolean = false,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(task.id, collapsibleState);
        this.id = (task.parentTaskId ?? 'root') + ':' + task.id;

        // Update label and description for active tasks
        if (this.isActive) {
            this.label = `${this.task.id} (active)`;
            this.description = `${this.task.status} • Active`;
        } else {
            this.description = this.task.status;
        }

        const updatedDate = new Date(this.task.updatedAt).toLocaleString();

        // Markdown tooltip for a premium feel
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`### **Task:** ${this.task.id}\n\n`);
        tooltip.appendMarkdown(`---\n\n`);
        tooltip.appendMarkdown(`* **Status:** ${this.task.status.toUpperCase()}\n`);
        tooltip.appendMarkdown(`* **Updated:** ${updatedDate}\n`);
        tooltip.appendMarkdown(`---\n\n`);
        tooltip.appendMarkdown(`*Click to open details*`);
        this.tooltip = tooltip;

        this.contextValue = `${this.task.type}${this.task.parentTaskId ? ':subtask' : ''}:${this.task.status}${this.isActive ? ':active' : ''}`;

        // Set click command
        this.command = {
            command: 'tasklist.openTaskDetails',
            title: 'Open Task Details',
            arguments: [this]
        };
        this.updateIcon();
    }

    public updateIcon(): void {
        // Use distinct icons based on type and state
        if (this.task.type === 'project') {
            const isExpanded = this.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;

            if (this.isActive) {
                this.iconPath = isExpanded
                    ? new vscode.ThemeIcon('root-folder-opened')
                    : new vscode.ThemeIcon('root-folder');
            } else {
                this.iconPath = isExpanded
                    ? new vscode.ThemeIcon('folder-opened')
                    : new vscode.ThemeIcon('folder');
            }
        } else if (this.isActive) {
            if (this.task.status == TaskStatus.InProgress) {
                this.iconPath = new vscode.ThemeIcon('star-full');
            } else {
                this.iconPath = new vscode.ThemeIcon('star');
            }
        } else {
            this.iconPath = this.getIconForStatus(this.task.status);
        }
    }

    private getIconForStatus(status: TaskStatus): vscode.ThemeIcon {
        switch (status) {
            case TaskStatus.InProgress:
                return new vscode.ThemeIcon('loading~spin');
            case TaskStatus.Closed:
                return new vscode.ThemeIcon('pass');
            case TaskStatus.Open:
            default:
                return new vscode.ThemeIcon('circle-large-outline');
        }
    }
}
