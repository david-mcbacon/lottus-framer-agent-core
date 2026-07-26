import { describe, expect, it } from "vitest";
import {
  METRIC_UNAVAILABLE,
  createPromptPrefixGuard,
  createPromptRunBaseline,
} from "../src/index.js";

describe("public Prompt Run baseline", () => {
  it("records host measurements and marks absent metrics unavailable", () => {
    const baseline = createPromptRunBaseline({
      trajectory: "canvas-edit",
      model: "provider/model",
      harnessProfile: "default",
      measurements: { modelSteps: 4, toolResultBytes: 1_024, durationMs: 800 },
      outcome: { functional: "passed", visualReview: "passed", unintendedSideEffects: [] },
    });
    expect(baseline.measurements).toEqual({
      modelSteps: 4,
      toolResultBytes: 1_024,
      durationMs: 800,
      cacheMisses: METRIC_UNAVAILABLE,
      cachedInputTokens: METRIC_UNAVAILABLE,
      freshInputTokens: METRIC_UNAVAILABLE,
    });
    expect(Object.isFrozen(baseline)).toBe(true);
  });

  it("rejects estimates represented as invalid measurements", () => {
    expect(() => createPromptRunBaseline({
      trajectory: "project-read",
      model: "provider/model",
      harnessProfile: "default",
      measurements: { cacheMisses: -1 },
      outcome: { functional: "not_reviewed", visualReview: "not_applicable", unintendedSideEffects: [] },
    })).toThrow("cacheMisses");
  });

  it("detects replacement, redaction, reordering, and removal of prompt-prefix entries", () => {
    const guard = createPromptPrefixGuard();
    const first = { role: "user", content: "read project" };
    const tool = { role: "tool", content: { text: "result", bytes: 6 } };
    guard.assert([first, tool]);
    expect(() => guard.assert([tool, first])).toThrow("changed or reordered");
    expect(() => guard.assert([first])).toThrow("removed");
    expect(() => guard.assert([first, { ...tool, content: "[redacted]" }])).toThrow("changed or reordered");
    expect(guard.assert([first, tool, { role: "assistant", content: "done" }]).entries).toBe(3);
  });
});
