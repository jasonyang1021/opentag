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
acceptance remain pending (I106); no commit, push or deployment in this task.
