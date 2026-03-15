# @tasklist/mcp - Model Context Protocol Server

The `@tasklist/mcp` package provides a standalone MCP server for the Tasklist Tool. It allows AI agents to manage hierarchical task structures and documentation artifacts through a standard interface.

## MCP-Specific Constraints

### Strict Scoping Rule

To interact with subtasks via this server, you **MUST** provide the `parentTaskId`. If you attempt to access a subtask without specifying its parent project, you will receive a **"Task not found"** error.

> [!TIP]
> If you receive a "Task not found" error for an ID you know exists, it is a strong signal that the task is a subtask and requires its `parentTaskId` parameter.

---

## Tool Reference

The `@tasklist/mcp` server exposes 12 tools for comprehensive task and artifact management.

> [!NOTE]
> For the complete list of tools, parameters, and examples, please refer to the [**Root README Tool Reference**](../../README.md#available-agent-tools).

---

## Usage for AI Agents

When working with hierarchical tasks:
1. Use `list_tasks` (without `parentTaskId`) to see top-level projects.
2. Use `list_tasks` (with `parentTaskId`) to see subtasks within a specific project.
3. Always include `parentTaskId` when calling lifecycle tools on subtasks.
4. Set an active task with `activate_task` to simplify subsequent artifact calls.
