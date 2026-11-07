# Agent generated image previews

Implementation complete; deployment and live browser acceptance pending.

Agent CLI uploads use an untyped Blob, causing image results to be persisted as
generic binary files. Detect PNG/JPEG/GIF/WebP from a bounded 16-byte prefix while
storage consumes the stream; preserve the actual bytes and existing authorization.
Reuse message attachment previews across channels, DMs and threads. Add download
and failed-preview feedback. Server-delivered guidance instructs agents to upload
and attach requested final image results, not just return local paths or links.

No daemon package or schema change; existing CLIs benefit after server deployment.
Guidance reaches the agent on subsequent message/check responses. No filesystem
watcher and no guarantee of previews for files an agent has not uploaded/attached.
Historical generic attachments are not migrated. Other formats keep existing behavior.

Validation: 15 focused tests pass, including a real HTTP multipart upload using
the CLI's untyped Blob shape, PNG byte equality, disguised HTML, limit regression,
malformed stream cleanup and delivery instructions. Another 27 MIME/XSS header
regressions pass with isolated test credentials. Typecheck and web build pass.
Required chrome-devtools is unavailable; real agent-to-browser and S3 acceptance
remain unverified, tracked in I111.
