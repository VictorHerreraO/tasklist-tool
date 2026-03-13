---
name: vscode-extension-builder
description: Instructions for initializing a standard VS Code extension workspace using TypeScript.
---

# VS Code TypeScript Extension Scaffolder

This skill provides mandatory instructions for setting up a standard development environment for a VS Code extension written in TypeScript.

> [!TIP]
> Use the [AI Extensibility Overview](./resources/ai-extensibility.md) to decide between Language Model Tools, MCP, or Chat Participants, and follow the [Language Model Tool API](./resources/llt-tool-api.md) guide for deep editor integration.

## 1. Workspace Scaffolding

When initializing a new extension project, follow these scaffolding rules:

### Standard Folder Structure
Ensure the following directories are present:
- `src/`: Contains all TypeScript source files.
- `out/`: Destination for compiled JavaScript files (should be gitignored).
- `.vscode/`: Workspace-specific configurations (e.g., `launch.json`, `settings.json`).
- `test/`: Project-specific tests.

### `package.json` Scaffolding
The `package.json` must include the following standard configurations:
- **Main Entry Point**: Set `"main": "./out/extension.js"`.
- **Engine**: Specify the minimum VS Code version supported.
- **Activation Events**: Define standard activation triggers (e.g., `"onCommand:..."`).
- **Scripts**:
  - `"vscode:prepublish": "npm run compile"`
  - `"compile": "tsc -p ./`
  - `"watch": "tsc -watch -p ./`
  - `"pretest": "npm run compile && npm run lint"`

> [!IMPORTANT]
> **Do not** include any publishing configurations (e.g., `vsce publish` scripts) or marketplace metadata unless explicitly requested by the user.

## 2. Testing & Linting Configuration

Integrate testing and linting tools to ensure code quality and functional correctness.

### Testing Framework Setup
Configure the extension to use the following mandatory testing stack:
- **Base Framework**: `mocha`
- **VS Code Integration**: `@vscode/test-cli` and `@vscode/test-electron`

#### Configuration Requirements
Generate the following configuration files with precise settings:

1. **`.vscode-test.mjs`**:
   - Use `mocha` as the test runner.
   - Set the label for the test suite.
   - Define the files pattern (e.g., `out/test/**/*.test.js`).

2. **`src/test/runTest.ts`**:
   - Implement the `main()` function using `@vscode/test-electron`.
   - Use `runTests` to launch an instance of VS Code with the extension and run the tests.

3. **`src/test/suite/index.ts`**:
   - Initialize the `Mocha` instance.
   - Use `glob` to find all test files in the `out` directory.
   - Run the tests and report results.

### Linting Configuration
Implement TypeScript linting using ESLint with the following baseline rules:

1. **`.eslintrc.json`**:
   - Extend `eslint:recommended` and `plugin:@typescript-eslint/recommended`.
   - Set the parser to `@typescript-eslint/parser`.
   - Include the `@typescript-eslint` plugin.
   - Configure basic rules (e.g., `@typescript-eslint/naming-convention`, `semi`, `curly`).

2. **`.eslintignore`**:
   - Ignore `out/`, `node_modules/`, and any generated artifacts.

### `package.json` Updates
Add the following scripts to the `scripts` section:
- `"lint": "eslint src --ext ts"`
- `"test": "vscode-test"`

## 3. Code Quality & Documentation

To maintain a high standard of code quality and maintainability, adhere to the following documentation policies:

### Mandatory JSDoc
Every **exported** function, class, and method in the generated extension must include a comprehensive JSDoc comment block.

#### Requirements:
Documentation blocks must include at least:
- **Description**: A clear and concise explanation of the element's purpose and behavior.
- **@param Tags**: (If applicable) Description of each input parameter, including its type and purpose.
- **@returns Tags**: (If applicable) Description of the return value, including its type and meaning.

> [!TIP]
> Use JSDoc to explain *why* a function exists and any side effects it might have, not just *what* it does.

## 4. User Involvement & Coordination

To ensure alignment with user requirements, the following interaction checkpoints are mandatory during the extension development lifecycle:

### Mandatory Consultation Checkpoints
Consult the user at these key milestones before proceeding to the next phase:

1. **Post-Scaffolding Review**: After generating the basic file structure, `package.json`, and `tsconfig.json`, but **before** installing any dependencies.
2. **Major Transition Approval**: Pause execution before starting full logic implementation or significant architectural changes.
3. **Dependency Confirmation**: Explicitly confirm the list of third-party libraries and tools to be installed beyond the mandatory testing/linting stack.

### Verification Protocol
For every interaction checkpoint:
1. **Pause execution.**
2. **Present a summary** of the current state, proposed changes, or file structure to the user.
3. **Wait for explicit user approval** (e.g., "Proceed", "Approved") before continuing.

## Resources

- [AI extensibility in VS Code](./resources/ai-extensibility.md)
- [Language Model Tool API](./resources/llt-tool-api.md)
