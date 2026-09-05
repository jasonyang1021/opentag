# Graph layout refinement

## Goal

Make the relationship graph easier to scan by expanding the connected network in the centre, placing isolated members around the perimeter, and giving interaction bundles a stronger arc.

## Scope

- Partition linked and isolated members during deterministic layout.
- Simulate linked members within a roomy central region.
- Place isolated members in stable pseudo-random positions around an outer ellipse.
- Increase curve bend while keeping all strands in a bundle on the same side.
- Add unit and production browser verification.

## Outcome

- Linked members now form a more spacious force-directed network in the centre.
- Unlinked members are distributed around the perimeter on a deterministic, jittered ellipse.
- Curve bundles have a stronger minimum bend and fan outward on one side of each relationship.

## Verification

- `node --import tsx --test test/collaborationGraph.unit.test.ts`: 5 tests passed.
- `npm run typecheck`: passed.
- `npm run web:build`: passed.
- Huawei Cloud health endpoint returned HTTP 200 after deployment.
- Production browser check confirmed 21 nodes and 54 curved interaction paths with linked members central and isolates peripheral.
