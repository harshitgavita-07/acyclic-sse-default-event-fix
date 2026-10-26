# Acyclic SwarmClient: empty SSE event-name fix

A small, reproducible protocol-compatibility fix for the public TypeScript SwarmClient in [acyclic-labs/sdk](https://github.com/acyclic-labs/sdk), pinned to commit `a52093dc6d871165adef437aae1c9cd81166c100` (checked October 26, 2026).

## The gap

For a valid event stream containing an empty `event:` field:

```text
id: 7
event:
data: {"seq":7}

```

The current client yields `{ id: "7", event: "", data: { seq: 7 } }`. The [WHATWG SSE dispatch algorithm](https://html.spec.whatwg.org/multipage/server-sent-events.html#dispatchMessage) initializes the event type to `message` and changes it only when the event-type buffer is nonempty. A consumer routing by `event === "message"` can therefore miss the frame.

This is a local standards-compliance reproduction against the actual SDK class, not evidence that Acyclic's hosted server currently emits empty event fields or that production customers are affected.

## Minimal fix

`fix.patch` changes only the yielded event name:

```diff
- yield { id, event, data: JSON.parse(data.join("\n")) as T };
+ yield { id, event: event || "message", data: JSON.parse(data.join("\n")) as T };
```

No requests, auth, reconnects, payloads, cursors or size limits change.

## Run the evidence

Prerequisites: Git, Node.js 22+, TypeScript compiler (`tsc`) on PATH. No paid API, token, hosted account or dependency install is required.

```sh
node verify.mjs
```

The runner downloads public source into a temporary directory, checks out the exact commit, compiles the real client, runs the negative control, applies the single-line change, and runs the same tests again. It also runs the pinned upstream HTTP test suite against the fixed client. Temporary files are removed after the run.

Results on Node 22.23.4:

| Check | Result |
|---|---|
| Unchanged upstream, new regressions | 5 fail, 2 pass (expected negative control) |
| Fixed upstream, same regressions | 7/7 pass |
| Existing upstream HTTP client suite | 12/12 pass |

The new tests cover LF/CRLF, whole-buffer and byte-fragmented delivery, named events, omitted event fields, and an empty field resetting an earlier named field. This is focused client validation, not the entire Rust/Bun workspace test suite. No upstream PR or maintainer acceptance is claimed.

## Files

- `verify.mjs`: fetch, pin, compile, reproduce, patch and verify.
- `regression.mjs`: seven behavioral checks against the actual compiled class.
- `fix.patch`: the upstream-ready one-line diff.

Built with AI assistance under Harshit's direction. This repository contains original test/verification glue and a minimal patch, not a copy of Acyclic's codebase. Upstream source remains under its Apache-2.0 license.
