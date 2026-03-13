# Tasklist Tool for VS Code

A VS Code extension for structured task and artifact management for AI agents and developers.

## Overview

The Tasklist Tool provides a robust framework for tracking development progress and maintaining structured documentation (artifacts) alongside code. It exposes a suite of **Language Model Tools** that allow AI agents to interactively manage tasks and generate documentation using standard templates.

## Hierarchical Task Management

The Tasklist Tool supports a hierarchical structure consisting of **Projects** and **Subtasks**.

### Projects vs. Tasks
- **Projects**: Act as containers for related work. They can hold multiple subtasks and are represented in the tree view as expandable folders.
- **Tasks**: Individual units of work. They can be standalone or nested within a project.

### Organizing Your Work
- **Nested Views**: View your tasks organized under projects in the **Tasklist Explorer** in the Activity Bar.
- **Promote to Project**: Easily convert any existing task into a project by right-clicking it in the tree view and selecting **"Promote to Project"**. This allows you to start adding subtasks to it.
- **Subtask Management**: When creating tasks via agent tools, you can specify a `parentTaskId` to nest them within a project.

## Key Features

- **Visual Tree View**: Monitor your task hierarchy, status, and progress directly from the VS Code sidebar.
- **Status Icons**: Quickly identify the state of your tasks (Open, In-Progress, Closed) with intuitive icons.
- **Active Task Context**: Set an "active" task to focus your (and your agent's) workflow.
- **Artifact Management**: Generate and update documentation artifacts (e.g., implementation plans, research notes) using YAML-based templates.

## Extension Views

The extension contributes a **Tasklist Explorer** view container to the Activity Bar, which contains the **Tasks** tree view.

## Commands

- **Promote to Project**: Right-click a task in the tree view to convert it into a project.

## Agent Tools

This extension exposes 12 core tools to the VS Code Language Model API, enabling AI agents to:
- Manage the task lifecycle (`list_tasks`, `create_task`, `start_task`, `close_task`, `promote_to_project`).
- Handle task focus (`activate_task`, `deactivate_task`).
- Manage documentation (`list_artifact_types`, `register_artifact_type`, `list_artifacts`, `get_artifact`, `update_artifact`).
