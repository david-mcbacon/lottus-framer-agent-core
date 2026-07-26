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
- `@lottus-agent/framer-core/testing` — public extension capture utilities for conformance tests.

```ts
import { createFramerAgentCoreExtension } from "@lottus-agent/framer-core";

const extension = createFramerAgentCoreExtension();
```

`ask_user` asks one designer-facing, single-select question with two to four visible outcomes. Its terminating result carries `lottus_design_question` details. A host persists the result and submits a later answer as a new user run; Core never waits for the answer.

## Scope and licensing

Core begins after the host has connected a Live Framer Session. Connections, credentials, persistence, Electron/React UI, and tenant security stay in the host. See [NOTICE.md](./NOTICE.md) for the separate treatment of Lottus names and marks.
