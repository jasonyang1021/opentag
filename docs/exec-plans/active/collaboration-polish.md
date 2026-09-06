# Collaboration polish

Goal: compact task filters, explicit file delivery and browser desktop notifications.

1. Keep task filters in one desktop row; searchable creator/assignee/channel menus,
   clear action, secondary layout control and compact narrow-screen filters.
2. Add server-provided delivery guidance to checked messages, preserving grant rules;
   include readable child-thread attachments in channel Files and refresh the view.
3. Opt-in per-user/workspace/device desktop notifications for live mentions, DMs and
   task review/completion; respect workspace mute, avoid active-conversation alerts,
   isolate workspace changes and deduplicate across tabs. No closed-page push.
4. Verify pure policies and types/build; attempt required isolated live/browser checks.
   Record unavailable verification explicitly. No production writes in this task.

Progress: code and documentation implemented. Root/web typecheck, production web
build and 13 targeted tests passed; one guarded DB integration test skipped.
`dev:e2e:up` refused startup because the isolated `.env` is absent. Local Docker and
the required chrome-devtools tool are unavailable. Live browser and Agent delivery
acceptance remain pending (I106).

Deployment follow-up (2026-09-06): application code `3e27597` committed/pushed and
deployed to the existing host. The app image built successfully; only the app container
was recreated. App/Postgres/Redis are healthy, HTTPS homepage and health respond, and
the served `index-LST2JPEV.js` SHA-256 matches the validated local build:
`3e5b980075395ead2af59257c8739147c1c4d8c617852bb612bd3b8551d2f7d0`.
Prior image retained as `open-tag-app:before-3e27597`. Existing host Compose changes
were preserved; temporary Dockerfile syntax-directive removal was restored after build.
This record is documentation-only; browser/Agent acceptance is still pending.
