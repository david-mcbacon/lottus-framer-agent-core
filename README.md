# Lottus Framer Agent Core

UI-agnostic Pi extension contracts for Framer agent work after a host has established an authenticated Live Framer Session.

## Install

```sh
pnpm add --save-exact @lottus-agent/framer-core@0.2.0
```

The host must provide the peer dependencies. This release is certified against exactly Pi `0.80.6` and does not promise compatibility with any wider Pi version range or bundle another Pi runtime. Node.js 20 or newer is supported.

## Compatibility

| Contract | Supported version |
| --- | --- |
| `@framer/agent` prompt/API fixture | `0.0.38` |
| Framer public API | Methods listed by `REQUIRED_FRAMER_PUBLIC_METHODS`; checked at runtime |
| Pi (`pi-ai`, `pi-coding-agent`) | `0.80.6` exactly |
| Node.js host | `>=20` |
| Explicit Context Picker target reads | `framer_read_node_context` |

Hosts must run `inspectFramerCompatibility` against the connected Framer runtime. A new upstream version is unsupported until its complete prompt fixture and public-method record pass conformance.

## Exports

- `@lottus-agent/framer-core` — aggregate assembly API, including `createFramerAgentCoreExtension`, execution and scratch adapters, evidence contracts, and session-local Framer Run State.
- `@lottus-agent/framer-core/pi` — `ask_user` and aggregate Pi extension factories.
- `@lottus-agent/framer-core/contracts` — Design Question schemas, types, discriminator, validation, and answer formatting.
- `@lottus-agent/framer-core/guidance` — deterministic Guidance compilation and Lottus-owned base instructions.
- `@lottus-agent/framer-core/testing` — public extension capture utilities for conformance tests.

Prompt Run efficiency, immutable-prefix, upstream compatibility, and model capability-profile baselines are documented in [`docs/baseline.md`](./docs/baseline.md).
The 0.2.0 release evaluation and Cloud-facing contract boundary are recorded in [`docs/release-0.2.0.md`](./docs/release-0.2.0.md).

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

`createFramerPatternExtension` and `extractObservedPatterns` preserve an existing project's design language from a small explicit set of live page or section scopes. They report bounded, deterministic colors, text styles, typography, spacing, radii, shadows, surfaces, layout patterns, and components with human-readable examples. Reusable styles remain distinct from incidental literals. Project styles absent from selected references are only heuristic avoid candidates, never forbidden values. Explicit user direction overrides observations.

This is Lottus observed-pattern extraction, not parity with Framer's private semantic analysis. Deterministic deviation checks complement geometry evidence; screenshots and human/agent visual judgment remain required for subjective quality.

`ask_user` asks one designer-facing, single-select question with two to four visible outcomes. Its terminating result carries `lottus_design_question` details. A host persists the result and submits a later answer as a new user run; Core never waits for the answer.

When supplied an execution adapter, the same extension registers typed canvas, publication, batched control/catalog, formatting-preserving text, read-only analytics, and supported component operations alongside `framer_docs`, guarded `framer_exec`, and evidence-gated completion. Supplying a scratch-file adapter adds bounded code-file listing/search plus the exact read/create/update/check lifecycle. Discovery never writes: a discovered name must re-enter the snapshot, optimistic-concurrency, expected-export, and post-mutation verification path before editing. Core does not expose undocumented frame-to-component behavior. Hosts own command execution, scratch filesystem policy, and stable result presentation.

## Maintainer workflows

### Develop with a sibling repository

Build Core and create a temporary global link, then consume it from the sibling host:

```sh
# In lottus-framer-agent-core
pnpm install
pnpm build
pnpm link --global

# In the host repository
pnpm link --global @lottus-agent/framer-core
```

Links are for development only. Restore a registry dependency and lockfile before committing host release configuration.

### Test a prerelease

Publish a semver prerelease with `pnpm release:rc`, which uses the non-stable `rc` tag. Install the immutable version—not the moving tag—in every release-candidate host:

```sh
pnpm add --save-exact @lottus-agent/framer-core@0.1.1-rc.1
```

Run Core's `pnpm verify`, then the host's typecheck, integration tests, and packaged-artifact checks. Confirm the lockfile resolves the npm tarball and the package uses the host's Pi peer runtime rather than installing another copy.

### Upgrade and verify a stable version

1. Run `pnpm verify` in Core and publish with `pnpm release:stable` only after prerelease acceptance.
2. In each host, run `pnpm add --save-exact @lottus-agent/framer-core@<version>` and commit both manifest and lockfile.
3. Search release configuration for stale prerelease, `file:`, and `link:` references.
4. Run Core conformance and packed-artifact verification plus the host's typecheck, focused integration suite, redistribution audit, and packaged runtime/Electron acceptance.
5. Record the exact Core version and redistribution result in the host release checklist.

### Roll back

Core versions are immutable. Do not unpublish or replace an artifact. Reinstall the last verified exact version in the host (for 0.2.0, rollback is `pnpm add --save-exact @lottus-agent/framer-core@0.1.0`), regenerate its lockfile from npm, rerun the same compatibility and packaged-artifact checks, and release the host rollback. Deprecate a faulty Core version on npm when appropriate; moving a dist-tag alone does not change an already locked host.

## Scope and licensing

Core starts only after a host has established an authenticated, preconnected Live Framer Session. It defines the agent tools, run state, evidence, structured questions/completion, and Guidance used after connection. It does **not** authorize projects, create or operate relays, manage credentials, or create, reconnect, health-check, or destroy Live Framer Sessions. Persistence, Electron/React UI, and tenant security also stay in the host.

The [MIT license](./LICENSE) grants rights to the source code. It does not grant rights to use Lottus names, logos, or product marks; see [NOTICE.md](./NOTICE.md).
