# Task filters, file delivery and desktop notifications

## Task toolbar

Task filters occupy the left of a single desktop toolbar; view/new-task controls stay
on the right. The global all-channel view offers a channel filter. A channel's Tasks
tab is already scoped and does not repeat it. Creator/assignee/channel menus are
searchable; clear resets filters. Board orientation remains in the secondary menu.
Below 820px of available panel width, filters collapse behind a button. The sidebar,
task states, creation scope and permission rules are unchanged. Filtering is over the
already-loaded tasks, not a new server-side search API.

## File delivery

`fileDeliveryPolicy.ts` supplies runtime-neutral delivery guidance through existing
agent `message/check` text. The original target header stays first; reply grants and
authorized task-thread targets remain authoritative. Final requested artifacts should
be uploaded and attached to the final successful reply, not merely left on the machine.
This is guidance, **not** a filesystem watcher, a guaranteed agent compliance mechanism,
or retroactive upload. Existing local-only artifacts must still be sent by the agent.
No daemon bundle changes are needed for this server-provided context.

`GET /api/channels/:id/files` delegates to `channelFiles.ts`: the latest 100 posted
attachments from the root and its readable direct child threads, excluding unsent
uploads and deleted threads. Each root/thread is checked with `canUserReadChannel`;
queries bind the authenticated workspace. Attachments retain their actual message and
channel IDs, so downloads use the existing independent access check. `source` describes
the root and parent message for thread results. No schema migration or file copying.
Files refreshes on channel attachment messages / parent thread updates and has an
explicit retry/refresh button. Folder organization and pagination are not added.

## Browser notifications

Settings → Notifications has an explicit permission request, per-account/workspace/
browser opt-in, test button and the existing server-side mute control. Notify only on
live structured mentions of the current user, their own DMs (not audited agent DMs),
and their created/assigned tasks reaching review/completion. System receipts and own
actions are excluded. Reconnect history is not replayed. Task status changes carry
optional `statusChange: {actorType, actorId}` on `task:updated`; claims/assignments do
not carry it. Repeated task status events are suppressed within the current session.

`desktopNotifications.ts` consumes only existing access-checked realtime events,
rechecks workspace mute before sending, and uses generic localized bodies without
message text. Clicking opens the source message. Current focused conversations and
open thread panels stay quiet. Same-browser tabs share a short-lived focused-view
record and bounded dedup ledger; Web Locks serialize publication where supported,
with notification tags as best-effort fallback otherwise. Permission, storage or
constructor failure never breaks chat. Workspace/account changes cancel pending
work and close notifications created by that session.

This first version requires a live open page in the active workspace. It does not
subscribe inactive workspaces, recover notifications for missed socket events, add
Web Push/service workers, or support mobile notifications. Browser/OS delivery remains
subject to permission and system quiet modes. API constraints checked against
[MDN Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification).

## Verification

- Root and web typecheck; production web build.
- `node --import tsx --test test/desktopNotifications.unit.test.ts test/fileDelivery.unit.test.ts test/onboarding.unit.test.ts`
- `TEST_DATABASE_URL=<isolated-local-test-db> node --import tsx --test test/channelFiles.integration.test.ts`
  (requires migrated schema; omitted URL explicitly skips rather than passing).
- Required live checks still pending: light/dark desktop/narrow toolbar interaction;
  denied/default/granted notification permissions, test delivery, focus/mute/multi-tab
  dedup and click navigation; Agent upload → authorized task-thread reply → Files;
  private/cross-tenant file access. See tech-debt I106.
