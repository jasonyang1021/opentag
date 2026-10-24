# Channel Human membership and self-leave

Status: implemented; isolated API integration and deployment pending; browser acceptance tracked in I109.

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
