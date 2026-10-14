# Agent auto-restore

## Goal and contract

Remember explicit start intent independently of transient status. On authenticated machine
reconnect, restore enabled, live, machine-bound agents using existing acknowledged starts,
session configuration and daemon resource admission. Explicit stop/reset/dequeue disables
restore even if the machine is offline. Message-triggered wake behavior stays unchanged.

## Steps and acceptance

1. Add an additive, idempotent migration; backfill only currently active/starting/queued/
   sleeping agents. Previously inactive rows remain disabled because their intent is unknown.
2. Serialize explicit lifecycle and restore per agent. Recheck current socket, machine,
   deletion and desired state before restoring; skip already-running inventory.
3. Test races, failures, duplicate ready, tenant/machine selection and existing lifecycle
   regressions; run typecheck and build. Run isolated real restart acceptance if available.
4. Sync schema, architecture, feature and verification-limit documentation.

## Decisions

- Server-side feature: no new daemon protocol or npm package is needed.
- Start errors remain visible; intent persists for the next reconnect, not a retry storm.
- Restore is not a guarantee of resuming an interrupted external side effect exactly once.
- No production migration/deployment is performed as part of local implementation.

## Progress

- Source inspection confirmed disconnect reconciliation erases transient status, but not
  session IDs; existing acknowledged starts already apply runtime/capability/resource checks.
- Implementation, schema/migration and doc-sync completed locally. Unit/structural lifecycle
  coverage, root/web typecheck, and production web build pass. Structural checks are not
  substitutes for DB migration or real WS/daemon testing.
- Live acceptance is blocked by the unavailable local Docker engine and chrome-devtools.
  Tracked in I108; no production schema/code changes have been made.

## Remaining live acceptance

- On an isolated migrated database, run the migration twice: active/sleeping rows retain
  intent, inactive/deleted rows do not gain it, and explicit false survives redeploy.
- Start two agents, explicitly stop one, then restart the Windows daemon: only the enabled
  agent restores, with the original session ID; another machine/tenant is unaffected.
- Disconnect/reconnect WS without killing runtimes: no duplicate starts. Stop while the
  restore RPC is pending and stop while offline: no later reconnect auto-restore.
- Apply memory pressure: starts queue instead of overcommitting. Inject one failed startup:
  remaining agents restore and the failure is visible in logs/status.
