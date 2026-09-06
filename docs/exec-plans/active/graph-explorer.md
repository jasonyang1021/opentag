# Collaboration graph explorer

## Goal

Turn the member graph into a readable exploration surface: organic layout, legible labels, persistent focus, search/filter controls, draggable nodes, and an interaction inspector.

## Decisions

- Retain the existing visibility-scoped API and its interaction-count semantics.
- Separate unique relationships from total interactions in product copy.
- Retain individual curved strands with an optional compact relationship view.
- Use responsive pixel coordinates so node positions and links share one coordinate system.
- Keep unlinked members in an irregular outer band; avoid implying connections that do not exist.
- No new dependencies or backend migrations.

## Verification

- Typecheck, frontend build, meaningful layout/filter regression tests.
- Browser: overview, search, filters, selection/inspector, reset, drag, narrow viewport.
- Deploy using the existing Huawei Cloud workflow and verify the production page.

## Progress

- Inspected current graph, backend response, design system, and supplied reference screenshots.
- Implemented the explorer and synchronized feature, architecture, and bilingual README documentation.
- Six helper tests, typecheck and production frontend build passed.
- Browser fixture verification: selection and edge inspector, search, interaction threshold and isolated-member filters, compact mode, zoom/reset, and node drag passed.
- At 390px the document has no horizontal overflow; the graph fits initially and can be zoomed/panned.
- Production deployment and live-data verification pending.
