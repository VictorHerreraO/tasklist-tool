---
name: vscode-docs-expert
description: Use this skill whenever you need to find information about Visual Studio Code, including the Extension API, core features, release notes, or theme development. If the user asks "how do I do X in VS Code," or "what's the API for Y," use this skill to find the official documentation first. It is particularly powerful for finding information that spans multiple versions or deep technical guides that aren't easily found via general keyword search.
---

# Visual Studio Code Docs Expert

This skill provides semantic access to the official Visual Studio Code documentation repository, located at `~/Workspace/_ref/vscode-docs`. It leverages the `vscode-docs` MCP to perform natural language queries against a comprehensive index of guides, API references, and release notes.

### Why Use This?
Semantic search goes beyond simple keyword matching. It understands intent and concepts. For example, a search for "capturing editor selection" will find results about the `TextEditor.selection` property and related events even if the exact terms differ.

## Documentation Overview
The documentation is organized into several key areas. Understanding these helps in applying targeted search filters:

- `api/`: **Core Extension API Reference**. Essential for anything related to building VS Code extensions.
  - `api/extension-guides/ai/`: Focused on the new AI extensibility (Chat, Language Model APIs, MCP).
  - `api/extension-capabilities/`: High-level what's-possible overviews (Theming, Workbench extension).
  - `api/ux-guidelines/`: Best practices for UI elements like Activity Bar, Menus, and Notifications.
- `docs/`: **General Guides & User Documentation**.
  - `docs/setup/`: Platform-specific installation (Mac, Windows, Linux, Raspberry Pi).
  - `docs/editor/`: Core editor features like multi-root workspaces and terminal.
  - `docs/languages/`: Language-specific support (Python, Java, Rust, etc.).
- `blogs/`: **Technical Deep-Dives & Announcements**. Often contains the "why" behind features.
- `release-notes/`: **Version History**. Best for finding when specific features were introduced or changed.
- `remote/`: Documentation for **Remote Development** (SSH, Dev Containers, WSL).
- `learn/`: High-level tutorials and webinars.

## Search Tool Usage
The `search` tool accepts several parameters to refine your results:

- **query**: Your natural language question or keywords.
- **limit**: Maximum results (Default: 10, Range: 1-100). Use higher limits for broad research.
- **refresh_index**: Set to `True` only if the underlying docs have changed. Defaults to `False` for speed.
- **paths**: Filter by file path pattern using GLOB wildcards. 
  - *Example*: `api/extension-guides/ai/*` to focus on AI features.
  - *Example*: `release-notes/v1_1*` to see recent major releases.
- **languages**: Filter by programming language(s).

## Effective Search Strategies
1. **Try broad first**: Start with a general query if you're unsure where the information resides.
2. **Filter by Path**: If you know you're looking for an API, use `paths: ['api/*']`. It significantly reduces noise from blogs or old release notes.
3. **Use the Inventory**: If search results are unclear, you can reference the `doc-metadata-inventory.md` (if available in context) to identify specific files or subdirectories that might be relevant.
4. **Follow the Links**: Semantic search results often include URLs. Use these to find related documentation or code samples.
