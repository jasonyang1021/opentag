# Original image download controls

Implemented locally; deployment and browser/device acceptance pending.

- Share message image UI between attachments and Markdown bodies, including linked images.
- Keep download buttons visible without hover in chat and the enlarged lightbox.
- Fetch original bytes, reject failed/non-image responses, use a Blob download with
  a safe filename, delay URL cleanup, and prevent duplicate clicks while pending.
- External images use CORS with credentials omitted and no referrer. No proxy or
  authorization bypass. Failure offers the original URL for manual browser saving.
- Maintain lightbox keyboard focus across close, download and failure-link controls.
- Do not claim downloads reached disk or a phone album; no native album API is used.

Verification: isolated tests cover safe filenames, same-origin versus cross-origin
credentials, rejected schemes, HTTP errors, non-image responses, empty responses and
network/CORS failures. All 3 helper tests, root/web typecheck and production build
passed. No schema or daemon changes.
Real mobile/desktop browser acceptance remains I112; chrome-devtools is unavailable.
