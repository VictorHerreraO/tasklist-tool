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

        const activeTask = this.taskManager.getActiveTask();
        let tasks: TaskEntry[];
        if (element) {
            // Fetch subtasks for the expanded project
            tasks = this.taskManager.listTasks(undefined, element.task.id);
        } else {
            // Fetch top-level projects and tasks
            tasks = this.taskManager.listTasks();
        }

        return tasks.map(task => new TaskTreeItem(task, task.id === activeTask?.id));
    }
}

/**
 * Represents a task or project in the tree view.
 */
export class TaskTreeItem extends vscode.TreeItem {
    constructor(
        public readonly task: TaskEntry,
        public readonly isActive: boolean = false
    ) {
        // Projects are expandable, tasks are leaves
        const collapsibleState = task.type === 'project'
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        super(task.id, collapsibleState);

        // Update label and description for active tasks
        if (this.isActive) {
            this.label = `${this.task.id} (active)`;
            this.description = `${this.task.status} • Active`;
        } else {
            this.description = this.task.status;
        }

        const createdDate = new Date(this.task.createdAt).toLocaleString();

        // Markdown tooltip for a premium feel
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`### **Task:** ${this.task.id}\n\n`);
        tooltip.appendMarkdown(`**Status:** ${this.task.status.toUpperCase()}\n\n`);
        tooltip.appendMarkdown(`**Type:** ${this.task.type}\n\n`);
        tooltip.appendMarkdown(`**Created:** ${createdDate}\n\n`);
        tooltip.appendMarkdown(`---\n\n`);
        tooltip.appendMarkdown(`*Click to open details*`);
        this.tooltip = tooltip;

        this.contextValue = `${this.task.type}:${this.task.status}${this.isActive ? ':active' : ''}`;

        // Set click command
        this.command = {
            command: 'tasklist.openTaskDetails',
            title: 'Open Task Details',
            arguments: [this]
        };

        // Use distinct icons
        if (this.isActive) {
            this.iconPath = new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'));
        } else if (this.task.type === 'project') {
            this.iconPath = new vscode.ThemeIcon('project');
        } else {
            this.iconPath = this.getIconForStatus(this.task.status);
        }
    }

    private getIconForStatus(status: TaskStatus): vscode.ThemeIcon {
        switch (status) {
            case TaskStatus.InProgress:
                return new vscode.ThemeIcon('sync~spin');
            case TaskStatus.Closed:
                return new vscode.ThemeIcon('pass-filled');
            case TaskStatus.Open:
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}
