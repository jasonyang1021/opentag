# Channel Human membership and self-leave

Status: implemented and deployed to the requested Alibaba host; browser acceptance tracked in I109.

- Add a Human picker alongside Agents; retain manageChannels capability enforcement.
- Validate membership targets against the current workspace; reject malformed targets.
- Expose self-leave to ordinary channel members, with confirmation and honest errors.
- Remove descendant thread memberships and clear realtime subscriptions on all of the user's tabs.
- Verify focused tests, root/web typecheck and web build; deploy only the requested Alibaba instance.

No schema or daemon package changes. Local Docker is unavailable, so database/browser verification must be reported separately from unit/build checks.

Local checks: member-target unit tests passed; root/web typecheck and web production build passed.
The guarded integration test covers tenant/role checks, duplicate invitations, private access
revocation, nested-thread cleanup, retained history and public rejoin; it skips unless
TEST_DATABASE_URL names a local test database. Required chrome-devtools is unavailable.

Deployment verification (2026-10-24): the built image passed all four focused tests,
including the real PostgreSQL integration suite, against a separate ephemeral PostgreSQL
container with no published ports and no production data. Redis connection warnings came
from eager module initialization; the membership cases do not allocate sequences and all
three clients were disconnected. The test database container was stopped/removed afterward.
Production app was recreated without restarting PostgreSQL/Redis. All containers healthy;
public HTTPS health and login returned 200, anonymous channel API returned 401, and the
served web asset hash matched the local production build. Configuration/database backup
and rollback image retained. No schema/daemon change or local daemon restart required.
