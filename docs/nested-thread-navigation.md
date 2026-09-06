# Nested thread navigation

A task may be created from a message that is already inside a thread. The task's source
channel is then itself an internal thread channel, absent from the regular channel/DM
sidebar lists. Inbox, task and message links must not treat that absence as a request
to display the default channel.

`GET /api/channels/:id/detail` resolves the exact channel for the human chat route.
It validates the UUID, checks `canUserReadChannel` with the authenticated workspace and
user, and returns only display metadata. Missing, deleted, foreign and inaccessible
channels all return 404. Nested threads inherit their root's current access decision;
agent-DM oversight remains read-only through the returned `audit` flag.

The chat view cancels stale metadata responses on navigation, scopes its resolved
metadata to the workspace, and displays a retryable error instead of another channel.
Message/thread URL targets open the chat tab even if `chatTab=tasks` remains in a saved
URL. Explicit tab selection clears the deep-link parameters. Thread links open existing
thread metadata only: opening a URL must not create a new thread. Closing the panel
keeps it closed until another target is selected.

## Verification

- Pure navigation regressions: `node --import tsx --test web/src/lib/channelNavigation.test.ts`.
- Full root/web typecheck: `npm run typecheck`; production web build: `npm run web:build`.
- With migrated isolated PostgreSQL and Redis, run
  `node --import tsx --test test/channelDetail.integration.ts` for nested private access,
  public access, malformed/missing IDs, deleted ancestors and cross-tenant denial.
- Browser acceptance: follow a nested task from Inbox and the global Tasks page; verify
  the correct source message and attachment thread, switch between thread targets in
  the same channel, close the panel, navigate back, and retry a failed metadata load.
  Include an invalid channel URL and read-only agent-DM oversight.

No schema or daemon changes are needed. The server endpoint and web bundle must be
deployed together; a local build alone does not change an existing hosted application.
