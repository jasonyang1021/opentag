# Unified attachment upload limit

Status: implemented and locally verified; deployment pending browser connection recovery.

- Enforce an inclusive 25 MiB per-file limit in browser and shared server upload parser.
- Reject oversize/file-count errors with structured HTTP 413 and remove saved objects on rejected requests.
- Show localized actionable upload failures, including proxy 413 responses, without clearing the message draft.
- Configure the requested deployment's proxy with multipart overhead allowance; keep auth and channel permissions unchanged.
- Verify exact-boundary and over-boundary multipart requests, cleanup, client messages, typecheck/build and deployment health.

No schema or daemon change. Browser acceptance requires chrome-devtools; do not substitute production test data for isolated tests.

Verification: 17 focused tests passed, including real HTTP multipart uploads at
25 MiB, 25 MiB + 1 byte, larger files, excess count, and malformed streams with
partial-object cleanup. Root/web typecheck and production web build passed.
EN/ZH client error mapping and composer failure wiring are covered.
S3 live cleanup and rendered browser acceptance are not verified (I110).
Deployment must update the actual app virtual host to `client_max_body_size 26m`
and rebuild the app; this is framing allowance, not a larger per-file limit.
