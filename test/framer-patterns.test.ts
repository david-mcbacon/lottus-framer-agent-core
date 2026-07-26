import { describe, expect, it } from "vitest";
import { createFramerAgentCoreExtension, extractObservedPatterns, findObservedPatternDeviations, renderObservedPatternGuidance, type FramerPatternReferenceScope } from "../src/index.js";
import { captureExtensionTools, requireCapturedTool } from "../src/testing.js";

const references: FramerPatternReferenceScope[] = [
  { scope: "/pricing", label: "Pricing", samples: [
    { kind: "color", value: "#111111", reusableName: "Ink", nodeLabel: "Heading" },
    { kind: "spacing", value: "24px", nodeLabel: "Cards" },
    { kind: "component", value: "Primary", reusableName: "Button", nodeLabel: "CTA" },
  ] },
  { scope: "/home#hero", label: "Home hero", samples: [
    { kind: "color", value: "#111111", reusableName: "Ink", nodeLabel: "Title" },
    { kind: "spacing", value: "24px", nodeLabel: "Actions" },
    { kind: "typography", value: "Inter 48/52 700", nodeLabel: "Title" },
  ] },
];

describe("observed Framer patterns", () => {
  it("is deterministic, bounded, preserves scopes, and distinguishes tokens from literals", () => {
    const first = extractObservedPatterns({ references, projectStyles: [{ kind: "color", name: "Unused Blue", value: "#00f" }, { kind: "color", name: "Ink", value: "#111" }] });
    const second = extractObservedPatterns({ references: [...references].reverse(), projectStyles: [{ kind: "color", name: "Ink", value: "#111" }, { kind: "color", name: "Unused Blue", value: "#00f" }] });
    expect(second).toEqual(first);
    expect(first.referenceScopes.map((item) => item.scope)).toEqual(["/home#hero", "/pricing"]);
    expect(first.patterns[0]).toMatchObject({ kind: "color", reusableName: "Ink", count: 2 });
    expect(first.patterns.find((item) => item.kind === "spacing")).not.toHaveProperty("reusableName");
    expect(first.heuristicAvoidCandidates).toEqual([{ kind: "color", name: "Unused Blue", value: "#00f" }]);
  });

  it("handles sparse and multiple systems without merging names or scanning beyond bounds", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ scope: `/p${index}`, label: `Page ${index}`, samples: index < 2 ? [] : [{ kind: "color" as const, value: "#fff", reusableName: index % 2 ? "Light/Ink" : "Marketing/Ink", nodeLabel: "Text" }] }));
    const result = extractObservedPatterns({ references: many, maxPatterns: 1 });
    expect(result.referenceScopes).toHaveLength(6);
    expect(result.patterns).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it("lets explicit direction override guidance and exposes no mutable node ids", () => {
    const report = extractObservedPatterns({ references });
    const guidance = renderObservedPatternGuidance(report, "Use the campaign's bright red CTA instead");
    expect(guidance).toContain("Explicit user direction overrides");
    expect(guidance).toContain("not Framer private semantic analysis");
    expect(guidance).not.toMatch(/node-[a-z0-9]+/i);
  });

  it("flags measurable deviations without claiming subjective failure", () => {
    const report = extractObservedPatterns({ references });
    expect(findObservedPatternDeviations(report, [{ kind: "spacing", value: "17px", nodeLabel: "New card" }])).toEqual([{ kind: "spacing", nodeLabel: "New card", observedValue: "17px", expectedExamples: ["24px"] }]);
  });

  it("registers a live bounded extraction tool independently of mutation support", async () => {
    const tools = captureExtensionTools(createFramerAgentCoreExtension({ patternAdapter: {
      async readReferenceScopes(input) { expect(input.scopes).toEqual(["/home", "/pricing"]); return references; },
      async readProjectStyles() { return [{ kind: "shadow", name: "Legacy" }]; },
    } }));
    const result = await requireCapturedTool(tools, "framer_extract_observed_patterns").execute("patterns", { scopes: ["/pricing", "/home"], explicitUserDirection: "Keep existing CTA" } as never) as { content: Array<{ text: string }>; details: { methodology: string } };
    expect(result.details.methodology).toBe("lottus-observed-pattern-extraction");
    expect(result.content[0]!.text).toContain("Keep existing CTA");
  });
});
