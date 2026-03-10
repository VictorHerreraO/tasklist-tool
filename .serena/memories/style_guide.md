# Code Style and Conventions
- **Language**: TypeScript
- **Naming Conventions**: camelCase for variables and functions, PascalCase for classes and interfaces.
- **Linting**: Follow `eslint` rules defined in `.eslintrc.json`. Run `npm run lint` from the root workspace.
- **Testing**: Use Mocha and standard assertions in `packages/core`, and VS Code extension tests in `packages/extension`.
- **Templates**: AI Agent tools use `.ai.md` default templates loaded from YAML syntax logic.
- **Monorepo**: Dependencies and scripts are managed globally in the root `package.json` utilizing npm workspaces.