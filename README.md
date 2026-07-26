# Lottus Framer Agent Core

UI-agnostic Pi extension contracts for Framer agent work after a host has established an authenticated Live Framer Session.

## Install

```sh
pnpm add @lottus-agent/framer-core@0.1.0
```

The host must provide the peer dependencies. This release is certified against Pi `0.80.6` and does not bundle another Pi runtime.

## Exports

- `@lottus-agent/framer-core` — aggregate public API.
- `@lottus-agent/framer-core/pi` — `ask_user` and aggregate Pi extension factories.
- `@lottus-agent/framer-core/contracts` — Design Question schemas, types, discriminator, validation, and answer formatting.
- The aggregate export also provides the Framer execution and scratch-file adapters, canvas/code-file evidence contracts, and session-local Framer Run State.
- `@lottus-agent/framer-core/testing` — public extension capture utilities for conformance tests.

```ts
import {
  createFramerAgentCoreExtension,
  type FramerExecutionAdapter,
  type FramerScratchFileAdapter,
} from "@lottus-agent/framer-core";

declare const hostFramerAdapter: FramerExecutionAdapter;
declare const hostScratchAdapter: FramerScratchFileAdapter;
const extension = createFramerAgentCoreExtension({
  executionAdapter: hostFramerAdapter,
  scratchAdapter: hostScratchAdapter,
});
```

`ask_user` asks one designer-facing, single-select question with two to four visible outcomes. Its terminating result carries `lottus_design_question` details. A host persists the result and submits a later answer as a new user run; Core never waits for the answer.

When supplied an execution adapter, the same extension registers `framer_docs`, `framer_exec`, `framer_apply_changes`, and the evidence-gated `finish_framer_work` completion tool. Supplying a scratch-file adapter additionally registers the canonical `framer_read_code_file`, `framer_create_code_file`, `framer_update_code_file`, and `framer_check_code_file` lifecycle. Core owns filename/source validation, optimistic-concurrency snapshots, generated Framer scripts, normalized exports and diagnostics, expected-export checks, derived review status, structured completion, and session-local mutation/publication state. Hosts own command execution, scratch filesystem policy, and presentation of the stable `lottus_framer_completion` details.

## Scope and licensing

Core begins after the host has connected a Live Framer Session. Connections, credentials, persistence, Electron/React UI, and tenant security stay in the host. See [NOTICE.md](./NOTICE.md) for the separate treatment of Lottus names and marks.
