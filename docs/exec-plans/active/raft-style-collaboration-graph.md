# Raft-style collaboration graph

## Goal

Make Graph a first-class Members navigation destination and render the workspace as an interactive member-to-member collaboration network derived from shared channel membership.

## Scope

- Move Graph from the Members header toggle to the top of the Members sidebar.
- Project human/agent channel memberships into unique member-to-member links.
- Use a deterministic force layout with hover focus, pan, zoom, reset, refresh, and member navigation.
- Show Raft-style totals, most-connected members, and largest-channel summaries.
- Preserve the existing visibility-scoped graph API and its private-channel guarantees.
- Update unit tests and product/architecture documentation.

## Verification

- Graph helper unit tests.
- Root and web TypeScript checks.
- Production web build.
- Browser verification against a real workspace after deployment.
