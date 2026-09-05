# Collaboration graph + collaboration theme

Status: implementation complete; live-stack verification pending local infrastructure.

## Goal

Give workspace members a visual map of how humans and agents meet in channels, and add a compact cool-toned appearance inspired by modern human-agent collaboration products while keeping Tagora's own identity and assets.

## Shipped scope

- Added a tenant- and channel-visibility-scoped collaboration graph API.
- Added a Members list/graph switch with search, type filters, connection highlighting, navigation, and summary metrics.
- Added a third per-device appearance theme named Collaboration.
- Updated the feature checklist, API/frontend codemap, and English/Chinese README capability lists.

## Verification

- Deterministic graph layout/focus unit tests pass.
- Root + web TypeScript checks pass.
- Production web build passes.
- Live endpoint/browser verification was not available in this worktree because the host had no Docker command and PostgreSQL/Redis were not running; no database schema or daemon change is involved.

