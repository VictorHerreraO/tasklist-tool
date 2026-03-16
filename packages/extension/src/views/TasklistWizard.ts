import * as vscode from 'vscode';
import { TaskManager, SmartResultProvider, TaskEntry } from '@tasklist/core';
import { MultiStepInput } from './MultiStepInput.js';

interface State {
    title: string;
    step: number;
    totalSteps: number;
    project?: TaskEntry;
    taskId: string;
    type: 'task' | 'project';
}

type WizardItem = vscode.QuickPickItem & { project?: TaskEntry; action?: string };

/**
 * Interactive wizard for creating tasks and projects.
 */
export class TasklistWizard {

    /**
     * Runs the Tasklist creation wizard.
     * @param taskManager The TaskManager instance to use for creation.
     */
    public static async run(taskManager: TaskManager): Promise<void> {
        const wizard = new TasklistWizard(taskManager);
        await wizard.run();
    }

    private readonly smartResultProvider: SmartResultProvider;

    constructor(private readonly taskManager: TaskManager) {
        this.smartResultProvider = new SmartResultProvider(taskManager);
    }

    private async run() {
        const state: Partial<State> = {
            title: 'Create Task or Project',
            totalSteps: 2,
            type: 'task'
        };

        await MultiStepInput.run(input => this.pickProject(input, state));

        if (state.taskId) {
            try {
                await this.taskManager.createTask(state.taskId, state.type, state.project?.id);
                vscode.window.showInformationMessage(`${state.type === 'project' ? 'Project' : 'Task'} '${state.taskId}' created.`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create ${state.type}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    private async pickProject(input: MultiStepInput, state: Partial<State>) {
        const createStaticItems = (): WizardItem[] => {
            const items: WizardItem[] = [
                { label: 'Create New...', kind: vscode.QuickPickItemKind.Separator },
                {
                    label: '$(add) New Standalone Task',
                    action: 'standalone-task',
                    detail: 'Create a task without a parent project'
                },
                {
                    label: '$(repo) New Project',
                    action: 'new-project',
                    detail: 'Create a new top-level project'
                },
            ];

            const recent = this.smartResultProvider.getRecentProjects();
            if (recent.length > 0) {
                items.push({ label: 'Recent Projects', kind: vscode.QuickPickItemKind.Separator });
                items.push(...recent.map((p: TaskEntry) => ({
                    label: `$(project) ${p.id}`,
                    project: p,
                    detail: 'Project'
                })));
            } else {
                items.push({ label: 'Recent Projects', kind: vscode.QuickPickItemKind.Separator });
                items.push({
                    label: 'No projects yet',
                    detail: 'Recent projects will appear here',
                    alwaysShow: true
                });
            }
            return items;
        };

        const pick = await input.showQuickPick({
            title: state.title!,
            step: 1,
            totalSteps: 2,
            placeholder: 'Select a parent project or create new...',
            items: createStaticItems(),
            shouldResume: async () => true,
            onDidChangeValue: (value, quickPick) => {
                if (!value) {
                    quickPick.items = createStaticItems();
                    return;
                }
                const results = this.smartResultProvider.searchProjects(value);
                const searchItems: WizardItem[] = [
                    { label: 'Search Results', kind: vscode.QuickPickItemKind.Separator },
                    ...results.map((p: TaskEntry) => ({
                        label: `$(project) ${p.id}`,
                        project: p,
                        detail: 'Project'
                    }))
                ];
                if (results.length === 0) {
                    searchItems.push({ label: 'No matches found', alwaysShow: true });
                }
                quickPick.items = searchItems;
            }
        }) as WizardItem;

        if (!pick) {
            return;
        }

        if (pick.action === 'standalone-task') {
            state.type = 'task';
            state.project = undefined;
        } else if (pick.action === 'new-project') {
            state.type = 'project';
            state.project = undefined;
        } else if (pick.project) {
            state.type = 'task';
            state.project = pick.project;
        } else {
            // Placeholder picked or empty
            return;
        }

        return (inp: MultiStepInput) => this.inputTaskId(inp, state);
    }

    private async inputTaskId(input: MultiStepInput, state: Partial<State>) {
        const parentInfo = state.project ? ` in project '${state.project.id}'` : '';
        const typeInfo = state.type === 'project' ? 'Project' : 'Task';

        const taskId = await input.showInputBox({
            title: state.title!,
            step: 2,
            totalSteps: 2,
            value: state.taskId || '',
            prompt: `Enter ID for new ${typeInfo}${parentInfo}`,
            placeholder: 'e.g. feature-login',
            validate: async (value) => {
                if (!value || value.trim().length === 0) {
                    return 'ID cannot be empty';
                }
                const existing = this.taskManager.findEntryGlobally(value, state.project?.id);
                if (existing) {
                    return `ID '${value}' already exists.`;
                }
                return undefined;
            },
            shouldResume: async () => true
        });

        if (typeof taskId === 'string') {
            state.taskId = taskId;
        }
    }
}
