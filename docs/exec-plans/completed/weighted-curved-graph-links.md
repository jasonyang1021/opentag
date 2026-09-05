# Weighted curved graph links

## Goal

Make collaboration frequency visually legible in the Graph view with Raft-style curved link bundles.

## Scope

- Render one parallel curve per recorded interaction for normal-frequency relationships.
- Cap the visible bundle at 24 curves for browser safety while retaining the exact interaction count in tooltips and rankings.
- Count Links and most-connected members by interaction frequency rather than unique member pairs.
- Add a concise legend, unit coverage, documentation, and production browser verification.

## Outcome

- Each relationship is rendered as a bundle of quadratic curves, with one visible curve per interaction up to the 24-curve safety cap.
- The Links summary and most-connected ranking now use total interaction frequency.
- The production graph showed 54 interactions and rendered 54 SVG curves across 21 members.

## Verification

- `node --import tsx --test test/collaborationGraph.unit.test.ts`: 4 tests passed.
- `npm run typecheck`: passed.
- `npm run web:build`: passed.
- Huawei Cloud health endpoint returned HTTP 200.
- Production browser check confirmed Links = 54 and 54 graph paths.
