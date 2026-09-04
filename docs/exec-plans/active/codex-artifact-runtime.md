# Codex artifact runtime injection

## Goal

Make a Codex agent launched by the OpenTag daemon receive the same read-only runtime-path discovery capability that bundled document, spreadsheet, PDF, and presentation skills require.

## Design

- Bundle a dependency-free stdio MCP server with the daemon.
- Its sole `load_workspace_dependencies` tool returns validated paths below the local Codex primary-runtime cache. It accepts no caller paths and never writes or executes files.
- Start that MCP server only for the Codex adapter using App Server `mcp_servers` command-line configuration. The normal agent sandbox still governs later writes or command execution.

## Verification

1. Unit test the resolver against a temporary dependency tree and reject incomplete trees.
2. Unit test the MCP initialize/list/call protocol.
3. Build the daemon bundle and typecheck.
4. After installation and daemon restart, create a DOCX, XLSX, and PPTX from an OpenTag Codex agent.
