# Collaboration atlas

## Goal

Make the graph an inviting, playful exploration space without changing evidence or access boundaries.

## Decisions and steps

- Add locally scoped day/night palettes, constellation/orbit layouts, discover-member action and optional decorative flowing links.
- Keep motion explicitly illustrative, keyboard-operable and reduced-motion aware. Never infer live traffic or create relationships.
- Preserve search, filters, exact counts, inspectors, drag and zoom.
- Shortest-path exploration uses breadth-first search over filtered visible edges; disconnected members never receive invented routes.
- Verify deterministic orbit geometry, typecheck/build and real-browser interactions; synchronize feature documentation.

## Progress

- Inspected existing graph, data helpers and project constraints. No backend or dependency changes planned.
- Implemented both palettes/layouts, discovery, paused-by-default flowing light, member-count badges and connection trails.
- Eight unit tests, typecheck and frontend build passed. Desktop browser fixture checks passed for themes, layouts, exact 54 fixture interactions, 8 compact links / 54 strands, motion on/off, discovery, path and no-path results, search and filtered totals.
