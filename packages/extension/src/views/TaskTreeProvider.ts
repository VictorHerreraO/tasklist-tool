import * as vscode from 'vscode';
import { TaskManager, TaskEntry, TaskStatus } from '@tasklist/core';

/**
 * Provides a tree view of hierarchical tasks (Projects and Subtasks).
 */
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> =
        new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    constructor(private taskManager?: TaskManager) { }

    /**
     * Updates the task manager and refreshes the view.
     */
    setTaskManager(taskManager: TaskManager): void {
        this.taskManager = taskManager;
        this.refresh();
    }

    /**
     * Refreshes the tree view data.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
        if (!this.taskManager) {
            return [];
        }

        let tasks: TaskEntry[];
        if (element) {
            // Fetch subtasks for the expanded project
            tasks = this.taskManager.listTasks(undefined, element.task.id);
        } else {
            // Fetch top-level projects and tasks
            tasks = this.taskManager.listTasks();
        }

        return tasks.map(task => new TaskTreeItem(task));
    }
}

/**
 * Represents a task or project in the tree view.
 */
export class TaskTreeItem extends vscode.TreeItem {
    constructor(
        public readonly task: TaskEntry
    ) {
        // Projects are expandable, tasks are leaves
        const collapsibleState = task.type === 'project'
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        super(task.id, collapsibleState);

        this.tooltip = `${this.task.id} (${this.task.status})`;
        this.description = this.task.status;
        this.contextValue = this.task.type; // Used for context menus (e.g., promote to project)

        // Use distinct icons for projects vs tasks
        if (this.task.type === 'project') {
            this.iconPath = new vscode.ThemeIcon('project');
        } else {
            this.iconPath = this.getIconForStatus(this.task.status);
        }
    }

    private getIconForStatus(status: TaskStatus): vscode.ThemeIcon {
        switch (status) {
            case TaskStatus.InProgress:
                return new vscode.ThemeIcon('play-circle');
            case TaskStatus.Closed:
                return new vscode.ThemeIcon('check-all');
            case TaskStatus.Open:
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}
