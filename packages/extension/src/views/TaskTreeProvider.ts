import * as vscode from 'vscode';
import { TaskManager, TaskEntry, TaskStatus } from '@tasklist/core';

/**
 * Provides a tree view of hierarchical tasks (Projects and Subtasks).
 */
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem>, vscode.Disposable {
    private _activePath: Set<string> = new Set();
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
     * Refreshes the tree view data for the entire tree or a specific item.
     */
    refresh(item?: TaskTreeItem): void {
        this._onDidChangeTreeData.fire(item);
    }

    /**
     * Updates the expansion state of an item and refreshes it to update icons.
     */
    setExpanded(item: TaskTreeItem, expanded: boolean): void {
        item.collapsibleState = expanded
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed;

        this.refresh(item);
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        element.updateIcon();
        return element;
    }

    async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
        if (!this.taskManager) {
            return [];
        }

        // Refresh the active path if we are starting from the root
        if (!element) {
            this.updateActivePath();
        }

        let tasks: TaskEntry[];
        if (element) {
            tasks = this.taskManager.listTasks(undefined, element.task.id);
        } else {
            tasks = this.taskManager.listTasks();
        }

        this.sortTasks(tasks);

        return tasks.map(task => this.createTreeItem(task));
    }

    /**
     * Helper to centralize TreeItem creation and state calculation.
     */
    private createTreeItem(task: TaskEntry): TaskTreeItem {
        const compositeId = this.getCompositeId(task);
        const isActive = this._activePath.has(compositeId);
        
        // We use Expanded for active project paths, but let VS Code handle the rest.
        // Once revealed/expanded, VS Code remembers the state until refresh.
        const state = task.type === 'project'
            ? (isActive ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
            : vscode.TreeItemCollapsibleState.None;

        return new TaskTreeItem(task, isActive, state);
    }

    private getCompositeId(task: TaskEntry): string {
        return (task.parentTaskId ?? 'root') + ':' + task.id;
    }

    /**
     * Pre-calculates the active path (IDs of the active task and its ancestors).
     */
    private updateActivePath(): void {
        this._activePath.clear();
        if (!this.taskManager) {
            return;
        }

        const activeTask = this.taskManager.getActiveTask();
        if (!activeTask) {
            return;
        }

        // Add the active task itself
        this._activePath.add(this.getCompositeId(activeTask));

        // Add ancestors
        let currentParentId = activeTask.parentTaskId;
        while (currentParentId) {
            const result = this.taskManager.findEntryGlobally(currentParentId);
            if (!result) {
                break;
            }
            this._activePath.add(this.getCompositeId(result.entry));
            currentParentId = result.entry.parentTaskId;
        }
    }

    /**
     * Sorts tasks folder-style: Projects a-z followed by Tasks a-z.
     */
    private sortTasks(tasks: TaskEntry[]): void {
        tasks.sort((a, b) => {
            if (a.type === 'project' && b.type !== 'project') {
                return -1;
            }
            if (a.type !== 'project' && b.type === 'project') {
                return 1;
            }
            return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    /**
     * Required for treeView.reveal to work.
     */
    async getParent(element: TaskTreeItem): Promise<TaskTreeItem | undefined> {
        if (!this.taskManager || !element.task.parentTaskId) {
            return undefined;
        }

        const result = this.taskManager.findEntryGlobally(element.task.parentTaskId);
        if (result) {
            return this.createTreeItem(result.entry);
        }
        return undefined;
    }

    /**
     * Helper to find a TaskTreeItem for a specific taskId.
     */
    async getItemForId(taskId: string, parentTaskId?: string): Promise<TaskTreeItem | undefined> {
        if (!this.taskManager) {
            return undefined;
        }

        const result = this.taskManager.findEntryGlobally(taskId, parentTaskId);
        if (result) {
            return this.createTreeItem(result.entry);
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

        if (this.isActive) {
            this.label = `${this.task.id} (active)`;
            this.description = `${this.task.status} • Active`;
        } else {
            this.description = this.task.status;
        }

        const updatedDate = new Date(this.task.updatedAt).toLocaleString();

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`### **Task:** ${this.task.id}\n\n`);
        tooltip.appendMarkdown(`---\n\n`);
        tooltip.appendMarkdown(`* **Status:** ${this.task.status.toUpperCase()}\n`);
        tooltip.appendMarkdown(`* **Updated:** ${updatedDate}\n`);
        tooltip.appendMarkdown(`---\n\n`);
        tooltip.appendMarkdown(`*Click to open details*`);
        this.tooltip = tooltip;

        this.contextValue = `${this.task.type}${this.task.parentTaskId ? ':subtask' : ''}:${this.task.status}${this.isActive ? ':active' : ''}`;

        this.command = {
            command: 'tasklist.openTaskDetails',
            title: 'Open Task Details',
            arguments: [this]
        };
        
        this.updateIcon();
    }

    public updateIcon(): void {
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
            this.iconPath = new vscode.ThemeIcon(this.task.status === TaskStatus.InProgress ? 'star-full' : 'star');
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
            default:
                return new vscode.ThemeIcon('circle-large-outline');
        }
    }
}
