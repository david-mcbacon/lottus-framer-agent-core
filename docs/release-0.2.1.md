# Core 0.2.1 release evaluation

## Conformance

`pnpm verify` is the release gate. It typechecks, runs the complete public suite, packs the npm artifact, installs it in a clean consumer with exact peer runtimes, imports every export, assembles optional adapters, checks the redistribution allowlist and provenance records, and proves Core does not install a second Pi runtime.

This patch certifies `@framer/agent` `0.0.40`, requires explicit boolean assertions for generic mutation verification, and exports conservative source-effect classification for hosts without upstream effect metadata.

The suite covers Design Questions; mutation and publication evidence; routed Guidance; geometry, screenshots, external images, and stock images; typed project and code operations; explicit Context Picker target resolution; Design Plans and model profiles; code discovery; observed patterns; prompt-prefix continuity; and supported upstream compatibility.

## Baseline comparison

The `canvas-edit` and `project-read` trajectories use the public baseline, compatibility, extension-assembly, and profile-evaluation seams from `docs/baseline.md`.

| Signal | 0.1.0 baseline | 0.2.1 candidate | Release rule |
| --- | --- | --- | --- |
| Functional result | passed | passed by conformance | reject failure |
| Visual result | passed | passed by geometry/screenshot conformance | reject failure |
| Unintended side effects | none | none observed by isolated fixtures | reject additions |
| Prompt/cache continuity | immutable prefix | immutable prefix asserted | reject mutation/reorder |
| Model steps | unavailable | unavailable | never estimate |
| Tool-result bytes | unavailable | unavailable | never estimate |
| Cached/fresh tokens | unavailable | unavailable | never estimate |
| Cache misses | unavailable | unavailable | never estimate |
| Timing | unavailable | unavailable | never estimate |

Provider-only measurements remain explicitly unavailable because this release gate does not run a billable live model trajectory. Hosts compare any measured values with `createPromptRunBaseline` and reject regressions through `evaluateProfileEfficiency`; unknown values are not ranked. Routine canvas edits require geometry rather than a mandatory screenshot, so the tiered loop adds no bookkeeping screenshot step.

## Host and Cloud boundary

The public root, `contracts`, `pi`, `guidance`, and `testing` exports expose visual evidence, observed effects, typed queries, explicit Context Picker reads, Design Plans, model profiles, and observed-pattern contracts. Hosts provide authenticated execution, visual, and scratch-file adapters. Local Framer editor selection is user-provided through Context Picker payloads, never inferred by the headless session.

Core does not own credentials, relays, connection lifecycle, persistence, Electron UI, or Tenant Sandbox authorization/isolation. Lottus Cloud must adopt these contracts in issue #21 without moving sandbox security into Core.

## Compatibility and rollback

Supported versions are recorded in the README compatibility table. Desktop must pin immutable `0.2.1`, resolve it from the npm registry, and pass its packaged Electron acceptance. Roll back by pinning `0.2.0`, regenerating the host lockfile from npm, and repeating every host gate; never overwrite or unpublish an immutable Core artifact.
