# Completion Guidelines

Before marking a task as completed or creating a PR, you MUST ensure:
1. **Compilation**: The code compiles successfully without errors (`npm run compile`).
2. **Linting**: No linting errors are present (`npm run lint`).
3. **Testing**: All relevant unit and integration tests are passing (`npm run test`).
4. **Documentation**: Update `README.md` or templates as needed if a behavior change or new feature is introduced.
5. **Serena Guidelines**: Verify that no debugging `.tmp` files are left behind and that the Serena memory is up to date if architectural changes occurred.