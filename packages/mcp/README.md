# @tasklist/mcp - Model Context Protocol Server

The `@tasklist/mcp` package provides a standalone MCP server for the Tasklist Tool. It allows AI agents to manage hierarchical task structures and documentation artifacts through a standard interface.

## Hierarchical Task Management

The server supports a hierarchical task system where **Projects** (type: `project`) act as containers for **Subtasks** (type: `task`).

### Strict Scoping Rule

To interact with subtasks, you **MUST** provide the `parentTaskId`. If you attempt to access a subtask without specifying its parent project, you will receive a **"Task not found"** error.

> [!TIP]
> If you receive a "Task not found" error for an ID you know exists, it is a strong signal that the task is a subtask and requires its `parentTaskId` parameter.

---

## Tool Reference

### `activate_task`

Sets a task as the currently active task.

**Parameters:**
- `taskId` (string, required): The ID of the task to activate.
- `parentTaskId` (string, optional): The ID of the parent project. **Required for subtasks.**
- `activateProject` (boolean, optional): If `true`, also sets the parent project as the active task in the root index. Defaults to `true`.

**Example:**
```json
{
  "name": "activate_task",
  "arguments": {
    "taskId": "implementation-step-1",
    "parentTaskId": "core-engine-refactor",
    "activateProject": true
  }
}
```

### `start_task`

Transitions a task from `open` to `in-progress`.

**Parameters:**
- `taskId` (string, required): The ID of the task to start.
- `parentTaskId` (string, optional): The ID of the parent project. **Required for subtasks.**

**Example:**
```json
{
  "name": "start_task",
  "arguments": {
    "taskId": "fix-bug-123",
    "parentTaskId": "maintenance-sprint-1"
  }
}
```

### `close_task`

Transitions a task from `in-progress` to `closed`.

**Parameters:**
- `taskId` (string, required): The ID of the task to close.
- `parentTaskId` (string, optional): The ID of the parent project. **Required for subtasks.**

**Example:**
```json
{
  "name": "close_task",
  "arguments": {
    "taskId": "fix-bug-123",
    "parentTaskId": "maintenance-sprint-1"
  }
}
```

### `list_tasks`

Lists tasks in the workspace, optionally filtered by status or project.

**Parameters:**
- `status` (enum, optional): `open`, `in-progress`, or `closed`.
- `parentTaskId` (string, optional): Filter tasks by parent project ID. If omitted, only top-level tasks/projects are returned.

---

## Usage for AI Agents

When working with hierarchical tasks:
1. Use `list_tasks` (without `parentTaskId`) to see top-level projects.
2. Use `list_tasks` (with `parentTaskId`) to see subtasks within a specific project.
3. Always include `parentTaskId` when calling `activate_task`, `start_task`, or `close_task` on any subtask retrieved from a project.
