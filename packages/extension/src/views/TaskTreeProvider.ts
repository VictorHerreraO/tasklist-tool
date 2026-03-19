import * as vscode from 'vscode';
import { TaskManager, TaskEntry, TaskStatus, ArtifactService, TaskEventType } from '@tasklist/core';

/**
 * Constants for internal tree item segments.
 */
const TYPE_PROJECT = 'project';
const TYPE_ARTIFACT = 'artifact';
const ROOT_ID = 'root';

/**
 * Mapping of task status to VS Code icon IDs.
 */
const STATUS_ICONS: Record<string, string> = {
    [TaskStatus.InProgress]: 'loading~spin',
    [TaskStatus.Closed]: 'pass',
    'default': 'circle-large-outline'
};

/**
 * Provides a tree view of hierarchical tasks (Projects and Subtasks).
 */
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem | ArtifactTreeItem>, vscode.Disposable {
    private _activePath: Set<string> = new Set();
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | ArtifactTreeItem | undefined | null | void> =
        new vscode.EventEmitter<TaskTreeItem | ArtifactTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | ArtifactTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;
    private _subscriptions: vscode.Disposable[] = [];

    constructor(
        private taskManager?: TaskManager,
        private artifactService?: ArtifactService
    ) {
        if (this.taskManager) {
            this.setupSubscriptions(this.taskManager);
        }
    }

    private setupSubscriptions(taskManager: TaskManager): void {
        const unregister = taskManager.onDidUpdateTask((data) => {
            if (data.event === TaskEventType.Activated || data.event === TaskEventType.Deactivated) {
                this.updateActivePath();
            }
            this.refresh();
        });
        
        this._subscriptions.push({
            dispose: () => unregister()
        });
    }

    /**
     * Updates the task manager and refreshes the view.
     */
    setTaskManager(taskManager: TaskManager | undefined, artifactService?: ArtifactService): void {
        this.taskManager = taskManager;
        this.artifactService = artifactService;
        
        // Clear old subscriptions
        for (const sub of this._subscriptions) {
            sub.dispose();
        }
        this._subscriptions = [];

        if (this.taskManager) {
            this.setupSubscriptions(this.taskManager);
            this.updateActivePath();
        }

        this.refresh();
    }

    /**
     * Updates the expansion state of an item.
     */
    setExpanded(item: TaskTreeItem | ArtifactTreeItem, expanded: boolean): void {
        item.collapsibleState = expanded
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed;
        
        if (item instanceof TaskTreeItem) {
            item.updateIcon();
        }

        // Targeted refresh to update icons (e.g. folder-opened)
        this.refresh(item);
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
        for (const sub of this._subscriptions) {
            sub.dispose();
        }
    }

    getTreeItem(element: TaskTreeItem | ArtifactTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TaskTreeItem | ArtifactTreeItem): Promise<(TaskTreeItem | ArtifactTreeItem)[]> {
        if (!this.taskManager) {
            return [];
        }

        // Artifacts never have children
        if (element instanceof ArtifactTreeItem) {
            return [];
        }

        try {
            let tasks: TaskEntry[];
            if (element) {
                tasks = this.taskManager.listTasks(undefined, element.task.id);
            } else {
                tasks = this.taskManager.listTasks();
            }

            // Fix O(N) mutation: Copy before sorting to avoid mutating internal TaskManager state
            const sortedTasks = [...tasks];
            this.sortTasks(sortedTasks);
            const taskItems = sortedTasks.map(task => this.createTreeItem(task));

            // If it's a task/project, also fetch its artifacts
            if (element instanceof TaskTreeItem && this.artifactService) {
                const artifactItems = await this.getArtifactChildren(element.task);
                return [...taskItems, ...artifactItems];
            }

            return taskItems;
        } catch (error) {
            console.error('Error fetching tree children:', error);
            return [];
        }
    }

    private async getArtifactChildren(task: TaskEntry): Promise<ArtifactTreeItem[]> {
        if (!this.artifactService) {
            return [];
        }
        
        try {
            const artifacts = this.artifactService.listArtifacts(task.id, task.parentTaskId)
                .filter(a => a.exists);
            
            return artifacts.map(a => new ArtifactTreeItem(
                task.id,
                a.type.id,
                a.type.displayName,
                a.path,
                task.type === 'project',
                task.parentTaskId
            ));
        } catch (error) {
            console.error('Error fetching artifact children:', error);
            return [];
        }
    }

    /**
     * Helper to centralize TreeItem creation and state calculation.
     */
    private createTreeItem(task: TaskEntry): TaskTreeItem {
        const compositeId = TaskTreeItem.generateId(task);
        const isActive = this._activePath.has(compositeId);
        
        // All tasks and projects are expandable by default to show artifacts or subtasks.
        const state = isActive ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;

        return new TaskTreeItem(task, isActive, state);
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
        this._activePath.add(TaskTreeItem.generateId(activeTask));

        // Add ancestors
        let currentParentId = activeTask.parentTaskId;
        while (currentParentId) {
            const result = this.taskManager.findEntryGlobally(currentParentId);
            if (!result) {
                break;
            }
            this._activePath.add(TaskTreeItem.generateId(result.entry));
            currentParentId = result.entry.parentTaskId;
        }
    }

    /**
     * Refreshes the tree view data for the entire tree or a specific item.
     */
    refresh(item?: TaskTreeItem | ArtifactTreeItem): void {
        this._onDidChangeTreeData.fire(item);
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
    async getParent(element: TaskTreeItem | ArtifactTreeItem): Promise<TaskTreeItem | ArtifactTreeItem | undefined> {
        if (!this.taskManager) {
            return undefined;
        }

        try {
            if (element instanceof ArtifactTreeItem) {
                const result = this.taskManager.findEntryGlobally(element.taskId, element.parentTaskId);
                if (result) {
                    return this.createTreeItem(result.entry);
                }
                return undefined;
            }

            if (!element.task.parentTaskId) {
                return undefined;
            }

            const result = this.taskManager.findEntryGlobally(element.task.parentTaskId);
            if (result) {
                return this.createTreeItem(result.entry);
            }
        } catch (error) {
            console.error('Error finding tree parent:', error);
        }
        return undefined;
    }

    /**
     * Helper to find a TaskTreeItem for a specific taskId.
     */
    async getItemForId(taskId: string, parentTaskId?: string): Promise<TaskTreeItem | ArtifactTreeItem | undefined> {
        if (!this.taskManager) {
            return undefined;
        }

        try {
            const result = this.taskManager.findEntryGlobally(taskId, parentTaskId);
            if (result) {
                return this.createTreeItem(result.entry);
            }
        } catch (error) {
            console.error('Error finding item for ID:', error);
        }
        return undefined;
    }
}

/**
 * Represents a task or project in the tree view.
 */
export class TaskTreeItem extends vscode.TreeItem {
    static generateId(task: TaskEntry): string {
        return (task.parentTaskId || ROOT_ID) + '::' + task.id + '::' + task.type;
    }

    constructor(
        public readonly task: TaskEntry,
        public readonly isActive: boolean = false,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(task.id, collapsibleState);
        this.id = TaskTreeItem.generateId(task);

        // Clean label, use description for active state
        if (this.isActive) {
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

        this.contextValue = this.computeContextValue();

        this.command = {
            command: 'tasklist.openTaskDetails',
            title: 'Open Task Details',
            arguments: [this.task]
        };
        
        this.updateIcon();
    }

    private computeContextValue(): string {
        const type = this.task.type;
        const subtask = this.task.parentTaskId ? ':subtask' : '';
        const status = this.task.status;
        const active = this.isActive ? ':active' : '';

        return `${type}${subtask}:${status}${active}`;
    }

    public updateIcon(): void {
        const color = this.isActive ? new vscode.ThemeColor('progressBar.background') : undefined;
        let iconId: string;

        if (this.task.type === TYPE_PROJECT) {
            const isExpanded = this.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;
            iconId = isExpanded ? 'folder-opened' : 'folder';
        } else {
            iconId = STATUS_ICONS[this.task.status] || STATUS_ICONS['default'];
        }

        this.iconPath = new vscode.ThemeIcon(iconId, color);
    }
}

/**
 * Represents an artifact associated with a task.
 */
export class ArtifactTreeItem extends vscode.TreeItem {
    /**
     * Artifact parent is the Task. Format: [ParentID]::[ItemID]::[Type]
     */
    static generateId(taskId: string, artifactTypeId: string): string {
        return `${taskId}::${artifactTypeId}::${TYPE_ARTIFACT}`;
    }

    constructor(
        public readonly taskId: string,
        public readonly artifactTypeId: string,
        public readonly displayName: string,
        public readonly filePath: string,
        public readonly isProjectArtifact: boolean = false,
        public readonly parentTaskId?: string
    ) {
        super(displayName, vscode.TreeItemCollapsibleState.None);

        this.id = ArtifactTreeItem.generateId(taskId, artifactTypeId);
        this.description = isProjectArtifact ? 'Project' : undefined;
        this.contextValue = TYPE_ARTIFACT;
        this.iconPath = new vscode.ThemeIcon('file-code');
        
        this.command = {
            command: 'vscode.open',
            title: 'Open Artifact',
            arguments: [vscode.Uri.file(filePath)]
        };
    }
}
