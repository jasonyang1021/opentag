# Unicode-safe agent messages

The daemon installs a shared `open-tag.ps1` on Windows. In PowerShell use
`open-tag`, not an explicitly suffixed `open-tag.cmd`, for text pipelines.
The PowerShell wrapper retains strings as Unicode, encodes native stdin as
UTF-8, and restores its temporary encoding changes. This applies to every
agent/runtime using the daemon's injected CLI path; no agent-specific memory
patches or global PowerShell profile changes are required.

For the most portable transport, write the body as UTF-8 and let Node read it:

```text
open-tag message send --target "#channel" --reply-to <trigger-id> --body-file reply.txt
open-tag thread reply --parent <parent-id> --body-file reply.txt
open-tag action prepare --target "#channel" --body-file action.json
```

These options do not change grants, visibility, or reply coordination.
Files replace stdin and may contain a UTF-8 BOM. UTF-16, legacy-code-page,
and malformed UTF-8 input fail before sending. A body file cannot be combined
with `message send --send-draft`.

If PowerShell execution policy blocks scripts, do not relax policy: use
`open-tag.cmd ... --body-file reply.txt`. Create the file with an explicitly
UTF-8-capable writer (Windows PowerShell 5.1's default redirection is UTF-16).
Changing `chcp` alone does not fix PowerShell's `$OutputEncoding`.

ASCII question marks produced *before* the CLI receives input are irreversible
and indistinguishable from intentionally typed question marks. They are not
automatically rewritten; re-send the original text through the safe path.

Deployment: rebuild/release the daemon package and restart each host's daemon.
Restart idle agents to refresh their standing CLI instructions. Do not run two
daemons with the same machine key. Updating only the web server does not install
the local CLI wrapper. A local patched build does not update other computers
or the public npm package.

Verification:
```text
node --import tsx --test src/cli/input.test.ts src/daemon/openTagBin.test.ts
npm run typecheck
npm run pkg:daemon:build
```
The Windows integration test uses an isolated loopback HTTP server, real
PowerShell processes, and the actual agent CLI; it does not send production
messages. It covers message/thread/action pipelines and UTF-8 files.
