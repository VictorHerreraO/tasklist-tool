# Tasklist Tool for VS Code

A VS Code extension for structured task and artifact management for AI agents and developers.

## Overview

The Tasklist Tool provides a robust framework for tracking development progress and maintaining structured documentation (artifacts) alongside code. It exposes a suite of **Language Model Tools** that allow AI agents to interactively manage tasks and generate documentation using standard templates.

## Key Features

- **Visual Tree View**: Monitor your task hierarchy, status, and progress directly from the VS Code sidebar.
- **Status Icons**: Quickly identify the state of your tasks (Open, In-Progress, Closed) with intuitive icons.
- **Task Explorer**: A dedicated view container in the Activity Bar for streamlined task management.

## Agent Tools

This extension exposes **12 core tools** to the VS Code Language Model API.

> [!NOTE]
> For the complete list of tools, parameters, and examples, please refer to the [**Root README Tool Reference**](../../README.md#available-agent-tools).

## Commands
The extension contributes several commands to VS Code:
- **TaskList: Create Task**: Initialize a new task from a quick pick.
- **TaskList: Refresh**: Reload the task tree.
- **Promote to Project**: (Context menu) Convert an existing task to a project.

## Links
- [**Root README**](/) - Installation, building, and monorepo architectural overview.
- [**@tasklist/mcp**](../mcp/README.md) - Standalone MCP server details.
- [**@tasklist/core**](../core/README.md) - Logic engine and template system details.
