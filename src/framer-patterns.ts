import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export const MAX_PATTERN_REFERENCE_SCOPES = 6;
export const MAX_PATTERN_OBSERVATIONS = 80;
export const patternKinds = ["color", "text-style", "typography", "spacing", "radius", "shadow", "surface", "layout", "component"] as const;
export type FramerPatternKind = (typeof patternKinds)[number];

export interface FramerPatternSample {
  readonly kind: FramerPatternKind;
  readonly value: string;
  readonly nodeLabel: string;
  readonly reusableName?: string;
}
export interface FramerPatternReferenceScope {
  readonly scope: string;
  readonly label: string;
  readonly samples: readonly FramerPatternSample[];
}
export interface FramerProjectStyle {
  readonly kind: FramerPatternKind;
  readonly name: string;
  readonly value?: string;
}
export interface ObservedPattern {
  readonly kind: FramerPatternKind;
  readonly value: string;
  readonly reusableName?: string;
  readonly count: number;
  readonly examples: readonly { scopeLabel: string; nodeLabel: string }[];
}
export interface ObservedPatternReport {
  readonly methodology: "lottus-observed-pattern-extraction";
  readonly referenceScopes: readonly { scope: string; label: string }[];
  readonly patterns: readonly ObservedPattern[];
  readonly heuristicAvoidCandidates: readonly FramerProjectStyle[];
  readonly truncated: boolean;
}
export interface FramerPatternAdapter {
  readReferenceScopes(input: { readonly scopes: readonly string[]; readonly maxSamplesPerScope: number }, options: { readonly signal?: AbortSignal; readonly workspaceRoot: string }): Promise<readonly FramerPatternReferenceScope[]>;
  readProjectStyles(options: { readonly signal?: AbortSignal; readonly workspaceRoot: string }): Promise<readonly FramerProjectStyle[]>;
}

function compare(a: string, b: string): number { return a.localeCompare(b, "en"); }
function normalized(value: string): string { return value.trim().replace(/\s+/gu, " "); }
function styleKey(style: FramerProjectStyle): string { return `${style.kind}\0${normalized(style.name)}\0${normalized(style.value ?? "")}`; }

/** Deterministic, bounded observations from explicitly selected live reference scopes. */
export function extractObservedPatterns(input: {
  readonly references: readonly FramerPatternReferenceScope[];
  readonly projectStyles?: readonly FramerProjectStyle[];
  readonly maxPatterns?: number;
}): ObservedPatternReport {
  const maxPatterns = Math.min(Math.max(input.maxPatterns ?? 40, 1), MAX_PATTERN_OBSERVATIONS);
  const references = [...input.references]
    .filter((item) => item.scope.trim() && item.label.trim())
    .sort((a, b) => compare(a.scope, b.scope))
    .slice(0, MAX_PATTERN_REFERENCE_SCOPES);
  const groups = new Map<string, { kind: FramerPatternKind; value: string; reusableName?: string; examples: Map<string, { scopeLabel: string; nodeLabel: string }>; count: number }>();
  for (const reference of references) for (const sample of reference.samples.slice(0, 250)) {
    const value = normalized(sample.value); const reusableName = sample.reusableName ? normalized(sample.reusableName) : undefined;
    if (!value || !normalized(sample.nodeLabel)) continue;
    const key = `${sample.kind}\0${reusableName ?? ""}\0${value}`;
    const group = groups.get(key) ?? { kind: sample.kind, value, ...(reusableName ? { reusableName } : {}), examples: new Map(), count: 0 };
    group.count += 1;
    const example = { scopeLabel: normalized(reference.label), nodeLabel: normalized(sample.nodeLabel) };
    group.examples.set(`${example.scopeLabel}\0${example.nodeLabel}`, example); groups.set(key, group);
  }
  const allPatterns = [...groups.values()].sort((a, b) => b.count - a.count || compare(a.kind, b.kind) || compare(a.reusableName ?? "", b.reusableName ?? "") || compare(a.value, b.value));
  const patterns = allPatterns.slice(0, maxPatterns).map(({ examples, ...pattern }) => ({ ...pattern, examples: [...examples.values()].sort((a, b) => compare(a.scopeLabel, b.scopeLabel) || compare(a.nodeLabel, b.nodeLabel)).slice(0, 3) }));
  const usedReusable = new Set(allPatterns.flatMap((item) => item.reusableName ? [`${item.kind}\0${item.reusableName}`] : []));
  const heuristicAvoidCandidates = [...new Map((input.projectStyles ?? []).filter((style) => !usedReusable.has(`${style.kind}\0${normalized(style.name)}`)).map((style) => [styleKey(style), { ...style, name: normalized(style.name), ...(style.value ? { value: normalized(style.value) } : {}) }])).values()]
    .sort((a, b) => compare(a.kind, b.kind) || compare(a.name, b.name) || compare(a.value ?? "", b.value ?? "")).slice(0, 40);
  return { methodology: "lottus-observed-pattern-extraction", referenceScopes: references.map(({ scope, label }) => ({ scope, label: normalized(label) })), patterns, heuristicAvoidCandidates, truncated: references.length < input.references.length || patterns.length < allPatterns.length };
}

/** Agent-facing constraints. Explicit user direction always wins. */
export function renderObservedPatternGuidance(report: ObservedPatternReport, explicitUserDirection?: string): string {
  const lines = ["## Lottus observed patterns", "", "These are bounded observations from selected references, not Framer private semantic analysis or subjective design approval.", `Reference scopes: ${report.referenceScopes.map((item) => item.label).join(", ") || "none"}.`];
  for (const pattern of report.patterns) lines.push(`- ${pattern.kind}: ${pattern.reusableName ? `${pattern.reusableName} = ` : "literal "}${pattern.value} (${pattern.count}; e.g. ${pattern.examples.map((item) => `${item.scopeLabel}/${item.nodeLabel}`).join(", ")})`);
  if (report.heuristicAvoidCandidates.length) lines.push("", `Heuristic avoid candidates (exist in project, unobserved here; not forbidden): ${report.heuristicAvoidCandidates.map((item) => item.name).join(", ")}.`);
  lines.push("Use observed patterns as editing and verification constraints. Deterministic geometry may flag measurable deviations; screenshots still require visual judgment.");
  if (explicitUserDirection?.trim()) lines.push(`Explicit user direction overrides these observations: ${normalized(explicitUserDirection)}`);
  return `${lines.join("\n")}\n`;
}

export function findObservedPatternDeviations(report: ObservedPatternReport, samples: readonly FramerPatternSample[]): readonly { kind: FramerPatternKind; nodeLabel: string; observedValue: string; expectedExamples: readonly string[] }[] {
  const expected = new Map<FramerPatternKind, string[]>();
  for (const pattern of report.patterns) expected.set(pattern.kind, [...(expected.get(pattern.kind) ?? []), pattern.value]);
  return samples.flatMap((sample) => {
    const values = expected.get(sample.kind); const value = normalized(sample.value);
    return values?.length && !values.includes(value) ? [{ kind: sample.kind, nodeLabel: normalized(sample.nodeLabel), observedValue: value, expectedExamples: [...new Set(values)].slice(0, 5) }] : [];
  }).sort((a, b) => compare(a.kind, b.kind) || compare(a.nodeLabel, b.nodeLabel));
}

export function createFramerPatternExtension(adapter: FramerPatternAdapter): ExtensionFactory {
  return (pi: ExtensionAPI) => pi.registerTool({
    name: "framer_extract_observed_patterns", label: "Extract Observed Framer Patterns",
    description: "Extract deterministic, bounded design-system observations from a small explicit set of relevant live scopes. This is Lottus observed-pattern extraction, not Framer private semantic analysis.",
    parameters: Type.Object({ scopes: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { minItems: 1, maxItems: MAX_PATTERN_REFERENCE_SCOPES }), maxPatterns: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_PATTERN_OBSERVATIONS })), explicitUserDirection: Type.Optional(Type.String({ minLength: 1, maxLength: 1000 })) }, { additionalProperties: false }),
    executionMode: "sequential",
    async execute(_id, input, signal, _update, ctx) {
      const scopes = [...new Set(input.scopes)].sort(compare);
      const options = { ...(signal ? { signal } : {}), workspaceRoot: ctx?.cwd ?? process.cwd() };
      const [references, projectStyles] = await Promise.all([adapter.readReferenceScopes({ scopes, maxSamplesPerScope: 250 }, options), adapter.readProjectStyles(options)]);
      const report = extractObservedPatterns({ references, projectStyles, ...(input.maxPatterns ? { maxPatterns: input.maxPatterns } : {}) });
      return { content: [{ type: "text" as const, text: renderObservedPatternGuidance(report, input.explicitUserDirection) }], details: report };
    },
  });
}
