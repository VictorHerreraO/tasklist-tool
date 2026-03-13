# Updating `tasklist-mcp`

The `tasklist-mcp` server is installed globally via `npm link` from the `packages/mcp` directory in the monorepo.

## Update Steps
To update the global binary to the latest version in the workspace:

1. **Pull latest changes**:
   ```bash
   git pull origin main
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Recompile the project**:
   ```bash
   npm run compile
   ```

Since the binary is symlinked (`npm link`), recompiling the monorepo is sufficient to update the global `tasklist-mcp` behavior.

## Verification
You can verify the update by checking the timestamp of the compiled index file:
```bash
ls -alt packages/mcp/out/index.js
```
