# Running Activity recovery

Chat and thread history loads include `activeReplies`, a channel-scoped snapshot of running
Activity. The existing authenticated workspace/channel read check precedes snapshot access.
Older-page requests do not include active runs. No database schema, daemon protocol, or
message sequence changes are required.

The server captures the snapshot before querying durable messages. The client buffers
events during each HTTP request, restores the snapshot, then replays buffered events.
Request identity guards reject obsolete responses, including rapid A → B → A navigation.
Duplicate Activity is merged by timestamp and payload; finalized messages supersede previews.
Activity received without a start event can create a preview, except for a known finalized run.
An authorized `channel:joined` acknowledgment closes the initial room-subscription gap.
Room readiness after reconnect triggers the same recovery path.

The live projection is transient and single-process, matching current realtime fan-out.
It retains at most 500 pending items per run and 1,000 runs including terminal tombstones;
runs inactive for 24 hours expire. Publishing a durable segment transfers its Activity out
of the pending projection. Completion and offline events suppress stale snapshots.
Server restart/eviction loses the transient tail, not durable messages or Activity logs;
subsequent Activity rebuilds a partial preview. Multi-instance or restart-proof recovery
requires a shared/durable run ledger and is not claimed here.

Verification: `test/agentReplyRecovery.unit.test.ts` covers snapshot restoration, scope
isolation, completion/offline/supersession/expiry, bounded tails, missed starts, overlapping
events, durable completion races, and both views' request-identity wiring. Existing preview
tests cover replacement/receipt rendering contracts. Real DB/daemon/browser integration
must be distinguished from these deterministic tests in deployment reports.
