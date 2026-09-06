# Human-only mention routing

Human-authored channel/thread messages with resolved human mentions and no agent
mentions do not reserve or dispatch an automatic agent owner. Plain messages retain
the existing recent-owner selection; mixed human/agent mentions and DMs are unchanged.
Only resolved mentions count; arbitrary text resembling an unknown handle does not.

Both reservation and dispatch enforce the rule. Human-only messages form direct
boundaries with an immediate deadline so they cannot absorb subsequent plain requests.
This does not hide messages from agents already reading channel history.

Verification: root/web typecheck and unit/static tests. Live DB/daemon E2E is pending:
Docker/Postgres/Redis and the required browser test tooling are unavailable locally.
No production mutation, deployment, or member privilege changes are included.

## Related onboarding

The configurable one-time private welcome and language-first guidance are described in
`docs/member-onboarding.md`. Ordinary channel ownership remains independent of onboarding.

Existing action:prepare allows an agent to propose channel:create or agent:create.
Execution still uses the confirming human's manageChannels/manageAgents permissions.
A member cannot bypass that gate through an agent or an action card. Agent creation
also needs an appropriate machine/runtime. A future approved flow should let an admin
review the proposal in an accessible channel; automatic delegated creation would
need explicit limits and authorization and is outside this change.
