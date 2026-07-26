import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import type { PromptRunBaseline } from "./baseline.js";

export type LiveContextAvailability = "available" | "unavailable";
export interface LiveFramerContext {
  readonly observedAt: string;
  readonly availability: LiveContextAvailability;
  readonly unavailableReason?: string;
  readonly currentPage?: { readonly id?: string; readonly name: string; readonly path?: string };
  readonly currentScope?: { readonly id?: string; readonly name?: string; readonly kind?: string };
  readonly selection?: readonly { readonly id?: string; readonly name?: string; readonly kind?: string }[];
  readonly theme?: string;
  readonly attachments?: readonly { readonly name: string; readonly mediaType?: string }[];
  readonly relevantComponents?: readonly { readonly id?: string; readonly name: string }[];
  readonly codeFileMap?: readonly { readonly name: string; readonly path?: string }[];
  readonly styles?: readonly string[];
  readonly fonts?: readonly string[];
  readonly icons?: readonly string[];
  readonly shaders?: readonly string[];
  readonly timeContext?: { readonly now: string; readonly timeZone?: string };
}

export interface LiveFramerContextProvider {
  getLiveContext(input: { readonly prompt: string; readonly workspaceRoot?: string; readonly signal?: AbortSignal }): Promise<LiveFramerContext>;
}

export type FramerWorkStrategy = "creation" | "recreation" | "responsive" | "structural" | "edit";
export interface DesignPlanItem {
  readonly id: string;
  readonly title: string;
  readonly scope: string;
  readonly visibleDecisions: readonly string[];
  readonly reusableSystemDecisions: readonly string[];
  readonly verificationTargets: readonly string[];
}
export interface DesignPlan {
  readonly strategy: FramerWorkStrategy;
  readonly scope: string;
  readonly items: readonly DesignPlanItem[];
}

export interface FramerSteeringProfile {
  readonly structuredDesignQuestions?: boolean;
  readonly designPlans?: boolean;
  readonly dependencyWorkItems?: boolean;
}

export const LOTTUS_WORKING_SCOPE_GUIDANCE = `## Working scope

- For an unqualified edit, use the current live scope and selection.
- For an unambiguous named existing page, inspect and edit that page.
- Create a new page only when the request clearly asks for one.
- If a requested new page name collides with an existing page, ask a Design Question before changing either page.
- Newer Live Framer Context always overrides Generated Project Inventory.`;

export function requiresDesignPlan(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  if (/\b(copy|text|label|title|color|radius|opacity)\b/u.test(normalized)
    && /\b(change|update|replace|set|fix)\b/u.test(normalized)
    && !/\b(page|site|responsive|breakpoint|recreate|create|redesign|structure|layout)\b/u.test(normalized)) return false;
  return /\b(create|build|design|redesign|recreate|rebuild|responsive|breakpoint|page|site|structure|layout|section)\b/u.test(normalized);
}

export function renderLiveFramerContext(context: LiveFramerContext): string {
  validateLiveContext(context);
  const lines = ["## Live Framer Context", "", `- Observed at: ${context.observedAt}`, `- Rich canvas context: ${context.availability}`];
  if (context.unavailableReason) lines.push(`- Unavailable reason: ${context.unavailableReason}`);
  append(lines, "Current page", context.currentPage);
  append(lines, "Current scope", context.currentScope);
  append(lines, "Selection", context.selection);
  append(lines, "Theme", context.theme);
  append(lines, "Attachments", context.attachments);
  append(lines, "Relevant components", context.relevantComponents);
  append(lines, "Code-file map", context.codeFileMap);
  append(lines, "Styles", context.styles);
  append(lines, "Fonts", context.fonts);
  append(lines, "Icons", context.icons);
  append(lines, "Shaders", context.shaders);
  append(lines, "Time", context.timeContext);
  lines.push("", "This fresh host observation overrides conflicting Generated Project Inventory values.");
  return `${lines.join("\n")}\n`;
}

function append(lines: string[], label: string, value: unknown): void {
  if (value !== undefined) lines.push(`- ${label}: ${stableJson(value)}`);
}

function validateLiveContext(context: LiveFramerContext): void {
  if (!context.observedAt || Number.isNaN(Date.parse(context.observedAt))) throw new Error("Live context requires an ISO observedAt timestamp");
  if (context.availability === "unavailable" && !context.unavailableReason?.trim()) throw new Error("Unavailable live context requires a reason");
  const serialized = stableJson(context).toLowerCase();
  for (const forbidden of ["credential", "sessionid", "session_id", "connectionkey", "connection_key", "token", "authorization"]) {
    if (serialized.includes(`\"${forbidden}\"`)) throw new Error(`Live context exposes forbidden lifecycle or credential field: ${forbidden}`);
  }
}

const planItemSchema = Type.Object({
  id: Type.String({ pattern: "^[a-z0-9][a-z0-9-]*$" }),
  title: Type.String({ minLength: 1 }), scope: Type.String({ minLength: 1 }),
  visibleDecisions: Type.Array(Type.String({ minLength: 1 })),
  reusableSystemDecisions: Type.Array(Type.String({ minLength: 1 })),
  verificationTargets: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
}, { additionalProperties: false });
const designPlanSchema = Type.Object({
  strategy: Type.Union(["creation", "recreation", "responsive", "structural", "edit"].map((value) => Type.Literal(value))),
  scope: Type.String({ minLength: 1 }), items: Type.Array(planItemSchema, { minItems: 1 }),
}, { additionalProperties: false });
type DesignPlanInput = Static<typeof designPlanSchema>;

const workItemSchema = Type.Object({
  id: Type.String({ pattern: "^[a-z0-9][a-z0-9-]*$" }), dependencies: Type.Array(Type.String()),
  implementationEvidence: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  verificationEvidence: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
}, { additionalProperties: false });
type WorkItemInput = Static<typeof workItemSchema>;

export function createPromptRunSteeringExtension(options: {
  readonly liveContextProvider: LiveFramerContextProvider;
  readonly profile?: FramerSteeringProfile;
}): ExtensionFactory {
  const profile = options.profile ?? {};
  return (pi: ExtensionAPI) => {
    const plans = new Map<string, DesignPlanItem>();
    const completed = new Set<string>();
    pi.on("before_agent_start", async (event, context) => {
      const live = await options.liveContextProvider.getLiveContext({ prompt: event.prompt, workspaceRoot: context.cwd });
      const planRequirement = profile.designPlans !== false && requiresDesignPlan(event.prompt)
        ? "\n\nThis substantial request requires record_design_plan before implementation. Completion comes from structured implementation and verification evidence, never summary prose."
        : "";
      return { systemPrompt: `${event.systemPrompt}\n\n${LOTTUS_WORKING_SCOPE_GUIDANCE}${planRequirement}\n\n${renderLiveFramerContext(live)}` };
    });
    if (profile.designPlans !== false) pi.registerTool({
      name: "record_design_plan", label: "Record Design Plan",
      description: "Record the structured plan required before substantial Framer creation, recreation, responsive, or broad structural work. Trivial copy and narrow property edits need no plan.",
      promptSnippet: "Record stable design-plan items before substantial design work",
      parameters: designPlanSchema, executionMode: "sequential",
      async execute(_id, input: DesignPlanInput) {
        if (new Set(input.items.map((item) => item.id)).size !== input.items.length) throw new Error("Design Plan item ids must be unique");
        plans.clear(); for (const item of input.items) plans.set(item.id, item);
        return { content: [{ type: "text" as const, text: `Design Plan recorded: ${input.items.map((item) => item.id).join(", ")}` }], details: input };
      },
    });
    if (profile.dependencyWorkItems === true) pi.registerTool({
      name: "complete_framer_work_item", label: "Complete Framer Work Item",
      description: "Complete a planned work item with implementation and verification evidence after every dependency is complete.",
      promptSnippet: "Complete dependency-aware work items only with implementation and verification evidence",
      parameters: workItemSchema, executionMode: "sequential",
      async execute(_id, input: WorkItemInput) {
        if (!plans.has(input.id)) throw new Error(`Unknown Design Plan item: ${input.id}`);
        const unknown = input.dependencies.filter((id) => !plans.has(id));
        if (unknown.length) throw new Error(`Unknown dependencies: ${unknown.join(", ")}`);
        const pending = input.dependencies.filter((id) => !completed.has(id));
        if (pending.length) throw new Error(`Incomplete dependencies: ${pending.join(", ")}`);
        completed.add(input.id);
        return { content: [{ type: "text" as const, text: `Work item completed with structured evidence: ${input.id}` }], details: input };
      },
    });
  };
}

export function evaluateProfileEfficiency(baseline: PromptRunBaseline, candidate: PromptRunBaseline): { readonly accepted: boolean; readonly stepReduction: number | "unavailable"; readonly reason?: string } {
  const qualityPassed = candidate.outcome.functional === "passed"
    && candidate.outcome.visualReview !== "failed"
    && candidate.outcome.unintendedSideEffects.length === 0;
  if (!qualityPassed) return { accepted: false, stepReduction: "unavailable", reason: "Candidate regressed quality or safety" };
  const before = baseline.measurements.modelSteps; const after = candidate.measurements.modelSteps;
  if (before === "unavailable" || after === "unavailable") return { accepted: false, stepReduction: "unavailable", reason: "Model-step measurements unavailable" };
  return { accepted: after <= before, stepReduction: before - after, ...(after > before ? { reason: "Candidate did not reduce steps" } : {}) };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") { const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`; }
  return JSON.stringify(value);
}
