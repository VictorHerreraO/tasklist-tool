# Tighten Subtask API - APM Memory Root
**Memory Strategy:** Dynamic-MD
**Project Overview:** This project standardizes subtask access by requiring `parentTaskId` and implementing a cascading activation model across the Core, MCP, and VS Code extension layers. Includes improved error messaging for AI agents and Active Path highlighting in the UI.

## Phase 1 – Core Logic Updates Summary
* Successfully updated `TaskManager` and `ArtifactService` to enforce strict hierarchical scoping.
* Implemented recursive task resolution in `getActiveTask`.
* Fixed cascading activation logic in `activateTask` and added deep hierarchy support via `findEntryRecursive`.
* Achieved 100% test coverage with 115 passing tests.
* Involved Agents: Agent_Core, Agent_QA
* Logs:
  - [Task 1.1 - Core TaskManager Updates](.apm/Memory/Phase_01_Core_Logic_Updates/Task_1_1_Core_TaskManager_Updates.md)
  - [Task 1.3 - Complete TaskManager API Tightening](.apm/Memory/Phase_01_Core_Logic_Updates/Task_1_3_Complete_TaskManager_API_Tightening.md)
  - [Task 1.2 - Core Hierarchy Unit Tests](.apm/Memory/Phase_01_Core_Logic_Updates/Task_1_2_Core_Hierarchy_Unit_Tests.md)

## Phase 2 – MCP Layer Updates Summary
* Migrated hierarchical scoping capabilities to the MCP server.
* Updated Zod schemas and tool handlers for `activate_task`, `start_task`, and `close_task`.
* Created comprehensive documentation in `packages/mcp/README.md` with explicit guidance and examples for AI agents.
* Involved Agents: Agent_MCP
* Logs:
  - [Task 2.1 - Update MCP Tool Schemas](.apm/Memory/Phase_02_Foundation_Models_Manager/Task_2_1_Update_MCP_Tool_Schemas.md)
  - [Task 2.3 - Update MCP Documentation & Examples](.apm/Memory/Phase_02_Foundation_Models_Manager/Task_2_3_Update_MCP_Documentation_Examples.md)

