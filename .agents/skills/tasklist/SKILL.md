---
name: tasklist
description: >-
  Structured task and artifact management framework with project and task support.
  Use this skill when the user asks to create a task, update artifacts, manage projects,
  promote tasks to projects, break down work into subtasks, activate or deactivate tasks,
  track progress or anything involving task lifecycle management — even if
  they don't explicitly say "task".
compatibility: Requires the tasklist-tool MCP server to be running.
---

# Tasklist Framework

This project works with a tasklist framework. This system is used to handle multiple tasks in an agentic environment. The framework defines a set of standard artifacts that are available for each task. These artifacts can be either existing files or templates for the Agent to fill in and save.

## Key Concepts

### Task

A task is a unit of work that the Agent can perform. Tasks are defined in the tasklist framework and can be executed by the Agent. A task can be activated by the Agent and can have multiple artifacts associated with it. Its status can be open, in progress, or closed.

### Project

A project is a collection of tasks that are related to each other. Projects are used to group tasks and provide a higher level of organization for the Agent to work with. Projects can be activated by the Agent which will cause the `active task` to be set to the activated project.

### Subtask

A subtask is a task that is related to another task. Subtasks are used to break down a task into smaller, more manageable units. Subtasks can be activated by the Agent by passing the project id as a parameter to the activate task tool. This will cause the `active task` for that project to be set to the activated subtask.

### Active task

An active task is a task that is currently being worked on by the Agent. Only one task can be active at a time. The activation of a task is done by the Agent and is used to track the progress of the task. The active task is used by default by the tools when no task is specified.

> [!NOTE]
> Artifact related tools will use the active task id if none is provided.

Clear the active task when no specific task is being worked on, or when switching to a different context that isn't associated with any task. In multi-agent scenarios, prefer using explicit task IDs over relying on the active task.

**Guidelines**

A task may be activated in the following scenarios:

1. The user explicitly asks you to activate the task.
2. You are about to start actual development work on the task.
3. You are about to start actual development work on a subtask of the project in which scenario you should activate the project and then the subtask within that project.
4. The user **has not** requested to deactivate the task. When working in multi-agent scenarios agents should use an explicit task id and not rely on the active task.

> [!TIP]
> Always let know the user when a task is activated.

### Task Closure

Agents must not close tasks or projects autonomously — closure always requires explicit user instruction. Even if all work has been completed and verified, teammates may still add comments during PR review or further revisions may be needed. Wait for the user to confirm that a task or project is truly done before closing it.

### Artifact

An artifact is a file that is associated with a task. Artifacts can be either existing files or templates for the Agent to fill in and save. Each artifact has a type, which defines its purpose and structure.

### Artifact Types

Artifact types are dynamic and vary by workspace. Always call **list_artifact_types** to discover which types are available before working with artifacts. Do not assume a fixed set — workspaces may define custom types beyond the built-in defaults.

## Tools

This project uses the `tasklist-tool` MCP server to interact with the tasklist framework. Make sure to use the tools when needed.

## Framework

The rationale behind this framework is to provide a simple and effective way to manage tasks in an agentic environment. While its easy to create tasks for every chat, it is not always the best approach. You need to think if the current ask is a task that requires multiple steps or if it is a task that can be completed right away. If it is the latter, you should not create a task.
Tasks should be used when working on items that require multiple steps or when working on a project that requires multiple tasks to be completed.

Usually we start with a high level task and work on it and update its artifacts as we go but sometimes the scope for a task can be too big and we need to break it down into smaller tasks. In such cases we can promote a task to a project and create subtasks for it.

### Template system

By default the framework provides a set of templates for you to fill in. These templates are used to define a predictable structure for all of the artifacts within this framework. You can get the template for a specific artifact by using the get artifact tool. If there is no artifact for the given artifact type, the tool will return the template for that artifact type.

The framework supports adding custom templates for artifacts. This is useful when the project workflow requires to store information which doesn't fit the default templates. To register a custom artifact type, use the `register_artifact_type` tool with a template body. Once the template is registered it becomes immediately available for all tasks and projects.

> Example: You might want to add a `execution-report` artifact type to allow cross agent communication. A builder agent can provide a report for the task that an orchestator agent can use to get a high level overview of the work done.

In the case you identify the need for a new artifact type, you should prompt the user for explicit approval.

> [!NOTE]
> When a new artifact type is created, it is immediately available for use in **all** existing and future projects and tasks.

### Promotion

When a task is promoted to a project, you can continue to use the artifact tools to interact with the artifacts of the task. The artifacts will remain available for the project but the focus of those artifacts should be updated to reflect the new project context.

### Task structure

Think of the tasklist as a file system where each project or tasks and contains its artifacts:

```
.tasks
├── project1
│   ├── task1
│   │   ├── artifact1
│   │   └── artifact2
│   └── task2
│       ├── artifact1
│       └── artifact2
└── task2
    ├── artifact1
    └── artifact2
```

So for you to be able to get a project or task you will need to know it's id. If the task is a subtask you will need to know the project id it belongs to as well.

## Example

**User**: "Create a task to fix the broken search functionality"

**Agent behavior**:
1. Confirm task understanding (subject, user expectation, outcome)
2. Derive task ID → `fix-broken-search` (agent-generated, Priority 5)
3. `create_task(taskId: "fix-broken-search")`
4. `list_artifacts(taskId: "fix-broken-search")`
5. `update_artifact(taskId: "fix-broken-search", artifactType: "task-details", ...)`
6. Report: "Task created: `fix-broken-search`. Updated artifacts: task-details."

## Multi-Agent Usage

When multiple agents work on the same project:

- **Use explicit task IDs** in all tool calls instead of relying on the active task. Only a single active task exists globally, so concurrent agents would conflict.
- **Subtasks are the unit of delegation.** Each agent picks up one subtask independently.
- **Artifacts are the communication channel.** For example, agents may use a custom artifact type (e.g. a completion report) to record their changes and status so other agents or an orchestrator can read it without needing conversation history.
- **Respect dependencies.** Don't start a subtask until its blockers are closed.

## Workflows

Read the relevant workflow for the scenario you're handling. Pick the one that matches — don't load all of them.

- [New Task Creation](references/workflow-new-task.md): Read when **creating** a new task, project, or subtask.
- [Project Management](references/workflow-project-management.md): Read when **working within** an existing project (subtasks, activation, dependencies, parallel agents).
- [Task Promotion](references/workflow-task-promotion.md): Read when **promoting** a task to a project because its scope has grown.
- [Task Update](references/workflow-task-updates.md): Read when **updating artifacts** on an existing task (major decisions, discoveries, handoffs).
