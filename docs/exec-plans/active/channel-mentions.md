# Channel-scoped mentions

## Goal and decision

Only current channel members may be mentioned. Public visibility is not membership.
Threads inherit their parent channel roster; DMs retain their participants. Typing an
outsider's handle must not invite them or create a structured mention.

## Steps / verification

- Share the server-side mention roster between message parsing and a read-gated candidate endpoint.
- Load candidates per workspace/channel, clear stale lists, refresh on membership changes and menu open.
- Verify channel switching, failed loads, member changes, public/private/DM/thread boundaries and unchanged member mentions.
- Sync feature/API/security docs and run typecheck, unit tests, build, and isolated integration tests where available.

## Progress

- Replaced workspace-wide candidates and public-channel mention auto-invites with a shared current-member roster.
- Frontend scope-fences responses, refreshes on membership events/menu opening, and shows loading/error/empty states without a workspace fallback.
- Passed root/web typecheck, production web build, and 37 unit/static regression checks covering mentions, candidate wiring, composer sending, rendering, and themes.
- Updated membership integration cases for public/private/DM/thread scopes and parent-member removal; these live cases are not yet executed.
- Documentation synchronized: architecture/API contract, authorization, features, English/Chinese README, and plan index. No schema or daemon bundle changes.
- Local Docker/Postgres/Redis are unavailable; live isolated integration and agent-delivery verification remain pending. Do not test mutations on production.
- Required chrome-devtools browser tooling is unavailable; interactive UI verification remains pending. Deployment has been requested; release outcome is recorded in the deployment handoff.
