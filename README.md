# Lottus Framer Agent Core

UI-agnostic Pi extension contracts for Framer agent work after a host has established an authenticated Live Framer Session.

## Install

```sh
pnpm add @lottus-agent/framer-core@rc
```

The host must provide the peer dependencies. This release is certified against exactly Pi `0.80.6` and does not promise compatibility with any wider Pi version range or bundle another Pi runtime. Node.js 20 or newer is supported.

## Exports

- `@lottus-agent/framer-core` — aggregate assembly API, including `createFramerAgentCoreExtension`, execution and scratch adapters, evidence contracts, and session-local Framer Run State.
- `@lottus-agent/framer-core/pi` — `ask_user` and aggregate Pi extension factories.
- `@lottus-agent/framer-core/contracts` — Design Question schemas, types, discriminator, validation, and answer formatting.
- `@lottus-agent/framer-core/guidance` — deterministic Guidance compilation and Lottus-owned base instructions.
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

`compileFramerGuidance` accepts host/runtime-supplied Framer material and emits routed references, Project Inventory shards, complete verbatim raw fallback files, coverage and provenance records, warnings, and a stable content hash. Core packages no Framer-derived guidance; hosts discover it at runtime and may layer explicitly attributed system or agent additions.

`ask_user` asks one designer-facing, single-select question with two to four visible outcomes. Its terminating result carries `lottus_design_question` details. A host persists the result and submits a later answer as a new user run; Core never waits for the answer.

When supplied an execution adapter, the same extension registers `framer_docs`, `framer_exec`, `framer_apply_changes`, and the evidence-gated `finish_framer_work` completion tool. Supplying a scratch-file adapter additionally registers the canonical `framer_read_code_file`, `framer_create_code_file`, `framer_update_code_file`, and `framer_check_code_file` lifecycle. Core owns filename/source validation, optimistic-concurrency snapshots, generated Framer scripts, normalized exports and diagnostics, expected-export checks, derived review status, structured completion, and session-local mutation/publication state. Hosts own command execution, scratch filesystem policy, and presentation of the stable `lottus_framer_completion` details.

## Contributor consumption workflows

To exercise unpublished Core changes in a sibling host without depending on the repository layout, build and link the package:

```sh
# In lottus-framer-agent-core
pnpm install
pnpm build
pnpm link --global

# In the host repository
pnpm link --global @lottus-agent/framer-core
```

Before packaged Desktop acceptance, prefer the immutable prerelease artifact over linking:

```sh
pnpm add @lottus-agent/framer-core@rc
```

Maintainers verify the exact tarball with `pnpm test:pack` and publish it with `pnpm release:rc`, which explicitly selects the non-stable `rc` tag. Run `pnpm verify` before either workflow.

## Scope and licensing

Core begins after the host has connected a Live Framer Session. Connections, credentials, persistence, Electron/React UI, and tenant security stay in the host. See [NOTICE.md](./NOTICE.md) for the separate treatment of Lottus names and marks.
