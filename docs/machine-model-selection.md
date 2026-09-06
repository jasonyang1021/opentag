# Machine-scoped model selection

The create form only lists runtimes reported by its selected online machine.
Changing machine/runtime clears model and reasoning state. Creation is disabled
while discovery is pending or the loaded result belongs to a different selection.

The runtime-models endpoint checks tenant ownership, online status and detected
runtime before requesting the daemon. It returns `{models, source, reason}`:

- `source: cli`: choices returned by the machine's CLI/profile configuration.
- `source: unavailable`: empty list; reason is `machine_offline`,
  `runtime_missing`, `discovery_unsupported`, or `probe_failed`.
- Unknown/cross-tenant machines return 404. No preset model catalog is substituted.

Successful lists are cached per machine/runtime for 60 seconds. Refresh uses
`?refresh=1` to bypass the cache. CLI candidates are not a guarantee of account
authorization, quota or successful inference. Unsupported discovery (including
Claude help-only aliases, Copilot and Kimi) requires an explicit local-default
selection; no model/effort override is sent. Local default is marked unverified.

Codex uses the same executable resolution as agent startup, initializes a temporary
app-server, and reads all `model/list` pages with hidden entries excluded. One
deadline covers initialization and pagination. Errors, repeated cursors and output
overflow fail closed; the probe process tree is terminated. It never starts a
thread or inference turn. Model names, defaults and reasoning choices come from
the CLI, so newly available models do not require a web catalog update.

The shared Select positions its menu above/below the trigger according to available
viewport space, bounds its height/width, contains inner scrolling, and scrolls the
keyboard-highlighted item into view (including Home/End).

Deployment requires both server/web update and daemon 0.15.3 or later on each
compute host. A local build/commit is not a published npm release. This change
does not alter existing agents or add create-time inference calls. Project-specific
CLI configuration and account access still need real-run verification.

Tests: `test/codexModels.unit.test.ts` covers protocol, pagination, errors, timeout
and hidden entries; `test/modelPicker.unit.test.ts` covers viewport geometry and
selection/endpoint guards. These tests do not replace a browser or cloud acceptance test.
