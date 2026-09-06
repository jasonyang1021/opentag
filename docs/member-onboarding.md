# Language-first member onboarding

An owner/admin selects Cindy (or another live workspace agent) in Settings → Server →
New-member welcome agent. Off is the default; the existing `servers.onboardingAgentId`
field stores the choice. Receive-inbox, read-message and send-message scopes are required;
no scopes, member roles or machine permissions are automatically changed.

Only newly accepted invite memberships receive a private English welcome asking which
language they prefer. Existing members, personal-workspace creation and ordinary logins
do not trigger it. Turning the setting on does not backfill old memberships.

Invite acceptance locks its link and inserts membership with conflict handling. Membership,
the all-channel join, the two-participant DM and welcome message commit in one transaction.
An existing platform welcome suppresses re-welcoming after leaving and rejoining, while
that message exists. The welcome carries `actionMetadata.kind=member-welcome` and
`source=platform`; it is predefined copy on the configured agent's behalf, not a runtime
execution. No activity receipt or agent wake is generated. Realtime publication happens
after commit; bootstrap/reconnect can recover the persisted message if realtime fails.
An unavailable/deleted/misconfigured welcome agent skips the welcome without blocking joining.
Database/Redis failures roll the transaction back so a retry can safely complete the join.

The first human reply remains in ordinary DM history. On inbox check, only the original
welcome agent in that valid two-member DM receives its first reply (bounded, quoted as
user data) plus language-first guidance. It should use the latest explicit preference,
ask one question at a time, and learn the member's goals. This is conversational language
memory, not a separately inferred profile field or a change to the web interface locale.
Deleting the welcome/history removes that context. An offline agent's predefined welcome
is still visible; subsequent replies rely on ordinary DM delivery and an online runtime.

Resource creation still uses existing action cards and human manageChannels/manageAgents
checks. Cindy may prepare proposals when action:prepare is allowed, not execute privileged
creation on a member's behalf. Admins cannot read human DMs: sharing elsewhere requires
the member's consent and an already-accessible admin channel, or a proposal the member
can forward. No automatic admin forwarding/approval queue is introduced.

## Verification

Root/web typecheck, production web build, and policy/static wiring tests cover welcome copy,
scope requirements, multilingual context, routing-header compatibility and transactional
placement. No schema or daemon bundle changes are required.

Live Postgres/Redis/daemon E2E and browser verification remain pending because the isolated
infrastructure and required browser tooling are unavailable locally. Before deployment,
verify in an isolated stack: concurrent/repeated invite acceptance produces one welcome;
existing members receive none; invalid cross-workspace configuration is rejected; each
language response reaches only its guide; ordinary DM grants work after an offline restart;
a member cannot execute a creation card; an admin can execute a shared proposal.
