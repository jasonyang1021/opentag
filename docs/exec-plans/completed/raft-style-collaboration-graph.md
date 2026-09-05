# Raft-style collaboration graph

## Goal

Make Graph a first-class Members navigation destination and render the workspace as an interactive member-to-member collaboration network derived from real collaboration activity.

## Scope

- Move Graph from the Members header toggle to the top of the Members sidebar.
- Project visibility-safe mentions, replies, thread participation, and task assignments into unique weighted member-to-member links; keep channel membership for summary counts only.
- Use a deterministic force layout with hover focus, pan, zoom, reset, refresh, and member navigation.
- Show Raft-style totals, most-connected members, and largest-channel summaries.
- Preserve the existing visibility-scoped graph API and its private-channel guarantees.
- Update unit tests and product/architecture documentation.

## Verification

- Graph helper unit tests: 3 passed.
- Root and web TypeScript checks: passed.
- Production web build: passed.
- Huawei Cloud deployment: healthy over HTTPS.
- Real workspace browser verification: Graph sidebar entry, 21-node/8-link activity network, insight panels, node-to-profile navigation, zoom, and reset all passed.
