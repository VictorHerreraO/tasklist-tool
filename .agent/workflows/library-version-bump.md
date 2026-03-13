---
description: How to upgrade the project version
---

# Library Version Bump

1. Update the package version using the [bump_version.sh](/scripts/bump_version.sh)
2. Run `npm install` so that the `package-lock.json` file is updated.
3. If a task id was provided review the artifacts for the task in the tasklist.
4. If no task id then use git to review the changes since the last tag.
5. Update the changelog files.
6. Package the vsix file
7. Update the MCP server