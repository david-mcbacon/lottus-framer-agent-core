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
- The aggregate export also provides the Framer execution adapter, canvas evidence contracts, and session-local Framer Run State.
- `@lottus-agent/framer-core/testing` — public extension capture utilities for conformance tests.

```ts
import {
  createFramerAgentCoreExtension,
  type FramerExecutionAdapter,
} from "@lottus-agent/framer-core";

declare const hostFramerAdapter: FramerExecutionAdapter;
const extension = createFramerAgentCoreExtension({ executionAdapter: hostFramerAdapter });
```

`ask_user` asks one designer-facing, single-select question with two to four visible outcomes. Its terminating result carries `lottus_design_question` details. A host persists the result and submits a later answer as a new user run; Core never waits for the answer.

When supplied an execution adapter, the same extension registers `framer_docs`, `framer_exec`, and `framer_apply_changes`. Core owns their schemas, safety checks, canvas evidence normalization, and session-local mutation/publication state. The adapter owns command discovery and execution against a Live Framer Session that the host has already connected.

## Scope and licensing

Core begins after the host has connected a Live Framer Session. Connections, credentials, persistence, Electron/React UI, and tenant security stay in the host. See [NOTICE.md](./NOTICE.md) for the separate treatment of Lottus names and marks.
