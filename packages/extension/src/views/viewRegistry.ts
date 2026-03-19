import * as vscode from 'vscode';
import { TaskTreeProvider, TaskTreeItem } from './TaskTreeProvider.js';

/**
 * Handles the registration and event management for the extension's Tree Views.
 */
export function registerViews(context: vscode.ExtensionContext, treeProvider: TaskTreeProvider): vscode.TreeView<TaskTreeItem> {
    const treeView = vscode.window.createTreeView('tasklist-tree', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });

    context.subscriptions.push(
        treeView,
        treeView.onDidExpandElement(e => {
            treeProvider.setExpanded(e.element.id!, true);
        }),
        treeView.onDidCollapseElement(e => {
            treeProvider.setExpanded(e.element.id!, false);
        })
    );

    return treeView;
}
