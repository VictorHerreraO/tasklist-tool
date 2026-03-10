# Development Commands (Run from root)
All main scripts should be run from the repository root:

| Purpose                           | Command           |
| --------------------------------- | ----------------- |
| Download Dependencies             | `npm install`     |
| Compile All                       | `npm run compile` |
| Watch                             | `npm run watch`   |
| Lint                              | `npm run lint`    |
| Test All                          | `npm run test`    |
| Build VS Code Extension (`.vsix`) | `npm run package` |

# Running and Debugging

**VS Code Extension**:
1. Run `npm install` and `npm run compile`.
2. Press `F5` in VS Code to spawn an Extension Development Host.

**MCP Server**:
```bash
export TASKLIST_WORKSPACE=/path/to/test/project
# From root directory:
node packages/mcp/bin/tasklist-mcp
```