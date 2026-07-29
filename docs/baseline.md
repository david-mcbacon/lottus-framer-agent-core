# Core baseline

Run `pnpm test` to compare later models and harnesses against the same public seams.

## Trajectories

Record at least one `canvas-edit` and one `project-read` Prompt Run with `createPromptRunBaseline`. Supply only host or Provider measurements. Omitted measurements become `"unavailable"`; never substitute estimates. Record functional result, visual review, and each unintended side effect.

Before each model turn, pass the complete transcript to `createPromptPrefixGuard().assert(...)`. Any removal, replacement, redaction, or reordering of an earlier message or tool result fails the run. Appending remains valid, preserving a reusable prompt prefix.

`test/fixtures/framer-agent-0.0.40` is the complete real prompt capture for every supported upstream version (currently `0.0.40`). Compatibility tests compile it through public `compileFramerGuidance`, then record package/API/schema versions, critical prompt sections, and all public Framer methods Core tools require.

Capability profiles may omit optional structured Design Questions. Canvas safety tools, evidence gates, and structured completion remain identical.

## Comparison record

Store the returned baseline JSON beside the harness result. Compare matching trajectory and harness profile. Regressions are: failed functional/visual outcome, new side effects, increased measured cost/latency, prefix assertion failure, or incompatible upstream record. An unavailable metric stays unknown and must not be ranked.
