import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { parseCanvasMutationEvidence, serializeCanvasMutationEvidence } from "./canvas-evidence.js";
import { createFramerRunState, recordGenericMutation, type FramerRunState } from "./framer-run-state.js";

export const FRAMER_RESULT_PREFIX = "[LOTTUS_FRAMER_RESULT_V1]";

export const FRAMER_IMPLEMENTATION_GUIDES = [
  "Analytics", "Buttons", "CMS Collection Lists", "CMS Detail Pages", "Computed Values",
  "Cursors", "Effects", "FAQ", "Forms", "Grids", "Lists", "Logos", "Masks",
  "Navigations", "Overlays", "Shaders", "Spinners", "Typography", "Tables in CMS Rich Text",
] as const;

export interface FramerRenderedOutput {
  readonly visibleOutput: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface FramerExecutionResult extends FramerRenderedOutput {
  readonly rawOutput: string;
  readonly observedEffect?: FramerObservedEffect;
}

export interface FramerObservedEffect {
  readonly kind: "read" | "mutation" | "publication" | "unknown";
  readonly succeeded: boolean;
  readonly verificationAction?: string;
  readonly publicationTarget?: "branch" | "staging" | "production";
}

export interface FramerExecutionAdapter {
  docs(symbol: string, options: { signal?: AbortSignal; workspaceRoot: string }): Promise<FramerRenderedOutput>;
  execute(source: string, options: { signal?: AbortSignal; timeoutMs: number; workspaceRoot: string }): Promise<FramerExecutionResult>;
}

export interface FramerCanvasExtensionOptions {
  readonly state?: FramerRunState;
  readonly onSessionStateCreated?: (state: FramerRunState) => void;
}

function invokesCodeFileLifecycle(source: string): boolean {
  return /\bframer\s*\.\s*(?:createCodeFile|getCodeFile|getCodeFiles)\s*\(|\bsetFileContent\s*\(|\bCodeFile\s*\.\s*remove\s*\(/u.test(source);
}

const DEDICATED_OPERATION = /\b(?:replaceText|flattenComponentInstance|makeExternalComponentLocal|queryAnalytics|readComponentControls|readIconSetControls|readIcons|readLayoutTemplateControls|readShaderControls)\s*\(/u;

const KNOWN_MUTATOR = /\b(?:replaceText|flattenComponentInstance|makeExternalComponentLocal|set[A-Z][A-Za-z0-9_$]*|create[A-Z][A-Za-z0-9_$]*|update[A-Z][A-Za-z0-9_$]*|remove)\s*\(/u;
const KNOWN_READ = /\b(?:readProject|queryImages|queryAnalytics|read[A-Z][A-Za-z0-9_$]*|get[A-Z][A-Za-z0-9_$]*|serialize(?:Nodes)?|paginate)\s*\(/u;

export function observeFramerSourceEffect(source: string, succeeded: boolean): FramerObservedEffect {
  if (/\bpublish\s*\(/u.test(source)) return { kind: "publication", succeeded };
  if (KNOWN_MUTATOR.test(source) || /\bapplyChanges\s*\(/u.test(source)) return { kind: "mutation", succeeded };
  if (KNOWN_READ.test(source)) return { kind: "read", succeeded };
  return { kind: "unknown", succeeded };
}

function genericMutationReason(source: string, declared: string, observed?: FramerObservedEffect): string | undefined {
  if (observed?.kind === "mutation") return observed.verificationAction ?? "verify the adapter-observed mutation with the matching typed Core operation";
  if (KNOWN_MUTATOR.test(source)) return "repeat and verify the known mutation with the matching typed Core operation";
  if (declared === "mutate") return "verify the declared mutation with the matching typed Core operation";
  if (observed?.kind === "read") return undefined;
  if (declared === "read" && KNOWN_READ.test(source)) return undefined;
  return "classify and verify the advanced operation with a typed Core operation before completion";
}

function isExactDocsSymbol(query: string): boolean {
  return /^(?:framer(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+|[A-Z][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)$/u.test(query);
}

function extractStructuredResult(output: string): unknown {
  const marked = output.split(/\r?\n/u).filter((line) => line.startsWith(FRAMER_RESULT_PREFIX));
  if (marked.length !== 1) throw new Error("Framer operation returned invalid structured evidence.");
  try {
    return JSON.parse(marked[0]!.slice(FRAMER_RESULT_PREFIX.length));
  } catch {
    throw new Error("Framer operation returned malformed structured evidence.");
  }
}

function compactProjectQueryResult(kind: "implementation-guides" | "font-search", result: unknown): string {
  return JSON.stringify({
    source: "framer.agent.readProject",
    matcher: kind === "font-search" ? "framer-server" : undefined,
    kind,
    result,
  });
}

export function createFramerCanvasExtension(
  adapter: FramerExecutionAdapter,
  options: FramerCanvasExtensionOptions = {},
): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    const state = options.state ?? createFramerRunState();
    options.onSessionStateCreated?.(state);

    pi.registerTool({
      name: "framer_docs",
      label: "Framer Docs",
      description: "Look up one exact Framer API method or class symbol through the preconnected Framer control adapter.",
      promptSnippet: "Look up one exact unfamiliar Framer API symbol",
      parameters: Type.Object({ query: Type.String({ minLength: 2, maxLength: 160 }) }, { additionalProperties: false }),
      async execute(_id, input, signal, _update, ctx) {
        const query = input.query.trim();
        if (!isExactDocsSymbol(query)) {
          throw new Error("framer_docs requires an exact symbol, for example framer.createCodeFile or CodeFile.typecheck");
        }
        const rendered = await adapter.docs(query, { ...(signal ? { signal } : {}), workspaceRoot: ctx?.cwd ?? process.cwd() });
        return { content: [{ type: "text" as const, text: rendered.visibleOutput }], details: rendered.details };
      },
    });

    pi.registerTool({
      name: "framer_get_guides",
      label: "Framer Implementation Guides",
      description: "Retrieve one or more exact first-party Framer implementation guides in one bounded request.",
      promptSnippet: "Load exact implementation guides needed for the current plan",
      parameters: Type.Object({
        names: Type.Array(StringEnum(FRAMER_IMPLEMENTATION_GUIDES), { minItems: 1, maxItems: 8, uniqueItems: true }),
        pagePath: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
      }, { additionalProperties: false }),
      async execute(_id, input, signal, _update, ctx) {
        const unknown = input.names.find((name) => !FRAMER_IMPLEMENTATION_GUIDES.includes(name));
        if (unknown) throw new Error(`Unknown Framer implementation guide: ${unknown}`);
        const queries = input.names.map((name) => ({ type: "implementation-guide-from-index", name }));
        const source = `const result = await framer.agent.readProject(${JSON.stringify(queries)}${input.pagePath ? `, { pagePath: ${JSON.stringify(input.pagePath)} }` : ""}); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify(result));`;
        const executed = await adapter.execute(source, { ...(signal ? { signal } : {}), timeoutMs: 120_000, workspaceRoot: ctx?.cwd ?? process.cwd() });
        const result = extractStructuredResult(executed.rawOutput);
        const compact = compactProjectQueryResult("implementation-guides", result);
        return { content: [{ type: "text" as const, text: compact }], details: { ...executed.details, source: "framer.agent.readProject", guideNames: input.names } };
      },
    });

    pi.registerTool({
      name: "framer_search_fonts",
      label: "Framer Font Search",
      description: "Use Framer's server-side font matcher by exact family name or compact semantic query. Results preserve Framer ordering.",
      promptSnippet: "Search first-party Framer fonts without local reranking",
      parameters: Type.Object({
        search: Type.Union([
          Type.Object({ name: Type.String({ minLength: 1, maxLength: 120 }) }, { additionalProperties: false }),
          Type.Object({
            query: Type.String({ minLength: 2, maxLength: 160 }),
            limit: Type.Integer({ minimum: 1, maximum: 10 }),
            mustHave: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { maxItems: 12, uniqueItems: true })),
            mustHaveAlternativeCharacters: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 8 }), { maxItems: 12, uniqueItems: true })),
          }, { additionalProperties: false }),
        ]),
        pagePath: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
      }, { additionalProperties: false }),
      async execute(_id, input, signal, _update, ctx) {
        const query = { type: "font-search", ...input.search };
        const source = `const result = await framer.agent.readProject([${JSON.stringify(query)}]${input.pagePath ? `, { pagePath: ${JSON.stringify(input.pagePath)} }` : ""}); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify(result));`;
        const executed = await adapter.execute(source, { ...(signal ? { signal } : {}), timeoutMs: 120_000, workspaceRoot: ctx?.cwd ?? process.cwd() });
        const result = extractStructuredResult(executed.rawOutput);
        const compact = compactProjectQueryResult("font-search", result);
        return { content: [{ type: "text" as const, text: compact }], details: { ...executed.details, source: "framer.agent.readProject", matcher: "framer-server" } };
      },
    });

    pi.registerTool({
      name: "framer_exec",
      label: "Framer Execute",
      description: "Execute JavaScript in the preconnected Live Framer Session. Code-file lifecycle calls must use the typed code-file tools.",
      promptSnippet: "Execute non-code-file JavaScript in the Live Framer Session",
      parameters: Type.Object({
        source: Type.String({ minLength: 1, maxLength: 200_000 }),
        purpose: Type.String({ minLength: 1, maxLength: 240 }),
        effect: StringEnum(["read", "mutate", "publish", "other"] as const),
      }, { additionalProperties: false }),
      async execute(_id, input, signal, _update, ctx) {
        if (invokesCodeFileLifecycle(input.source)) {
          throw new Error("Use framer_read_code_file, framer_create_code_file, framer_update_code_file, or framer_check_code_file for code-file lifecycle operations.");
        }
        if (/\bapplyChanges\s*\(/u.test(input.source)) {
          throw new Error("Use framer_apply_changes for canvas DSL mutations.");
        }
        if (DEDICATED_OPERATION.test(input.source)) {
          throw new Error("Use the matching typed Framer operation instead of generic execution.");
        }
        if (/\bpublish\s*\(/u.test(input.source) || input.effect === "publish") {
          throw new Error("Use framer_publish for preview, confirmed publishing, and production deployment.");
        }
        const declaredMutation = input.effect === "mutate" || KNOWN_MUTATOR.test(input.source)
          || (input.effect !== "read" && !KNOWN_READ.test(input.source));
        let mutationVersion: number | undefined;
        if (declaredMutation) {
          const reason = genericMutationReason(input.source, input.effect);
          mutationVersion = recordGenericMutation(state, { verified: false, ...(reason ? { pendingAction: reason } : {}) });
        }
        const timeoutMs = /startConversation\s*\(/u.test(input.source) ? 600_000 : 120_000;
        const executed = await adapter.execute(input.source, { ...(signal ? { signal } : {}), timeoutMs, workspaceRoot: ctx?.cwd ?? process.cwd() });
        const reason = genericMutationReason(input.source, input.effect, executed.observedEffect);
        if (reason && !declaredMutation) mutationVersion = recordGenericMutation(state, { verified: false, pendingAction: reason });
        else if (reason) state.genericVerificationAction = reason;
        return {
          content: [{ type: "text" as const, text: executed.visibleOutput }],
          details: {
            ...executed.details,
            declaredEffect: input.effect,
            observedEffect: executed.observedEffect,
            ...(mutationVersion ? { mutationVersion } : {}),
          },
        };
      },
    });

    pi.registerTool({
      name: "framer_publish",
      label: "Framer Publish",
      description: "Preview publication readiness, confirm the current preview hash, or promote a staging version to production.",
      promptSnippet: "Preview before publishing; confirm only the latest hash",
      parameters: Type.Union([
        Type.Object({ action: Type.Literal("preview") }, { additionalProperties: false }),
        Type.Object({ action: Type.Literal("confirm_publish"), confirmationHash: Type.String({ minLength: 1, maxLength: 500 }) }, { additionalProperties: false }),
        Type.Object({ action: Type.Literal("deploy_to_production"), version: Type.String({ minLength: 1, maxLength: 500 }) }, { additionalProperties: false }),
      ]),
      executionMode: "sequential",
      async execute(_id, input, signal, _update, ctx) {
        if (input.action === "confirm_publish" && input.confirmationHash !== state.publicationPreviewHash) {
          throw new Error("Publication confirmation is stale or was not previewed in this session; run framer_publish preview again.");
        }
        const source = `const result = await framer.agent.publish(${JSON.stringify(input)}); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify(result));`;
        const executed = await adapter.execute(source, { ...(signal ? { signal } : {}), timeoutMs: 120_000, workspaceRoot: ctx?.cwd ?? process.cwd() });
        const result = extractStructuredResult(executed.rawOutput);
        if (typeof result !== "object" || result === null) throw new Error("Framer publication returned invalid structured evidence.");
        const record = result as Record<string, unknown>;
        const errors = Array.isArray(record.errors) ? record.errors : [];
        const failed = record.success === false || record.status === "failed" || record.status === "blocked" || errors.length > 0;
        if (input.action === "preview") {
          if (typeof record.confirmationHash === "string" && !failed) state.publicationPreviewHash = record.confirmationHash;
          else delete state.publicationPreviewHash;
        } else if (!failed && (record.success === true || record.status === "success" || record.status === "published" || record.status === "deployed")) {
          state.published = true;
          state.publicationTarget = input.action === "deploy_to_production"
            ? "production"
            : record.target === "branch" ? "branch" : record.target === "production" ? "production" : "staging";
        }
        return { content: [{ type: "text" as const, text: executed.visibleOutput }], details: { ...executed.details, action: input.action, result } };
      },
    });

    pi.registerTool({
      name: "framer_verify_mutation",
      label: "Verify Framer Mutation",
      description: "Run a read-only verification for the latest generic mutation. Evidence advances only when the host observes a successful read.",
      promptSnippet: "Verify the latest generic mutation with a focused read",
      parameters: Type.Object({
        mutationVersion: Type.Integer({ minimum: 1 }),
        assertion: Type.String({
          minLength: 1,
          maxLength: 200_000,
          description: "One read-only JavaScript boolean expression. Example: (await framer.agent.getNode({ id: 'hero' }))?.name === 'Hero'.",
        }),
        expected: Type.String({ minLength: 1, maxLength: 500 }),
      }, { additionalProperties: false }),
      executionMode: "sequential",
      async execute(_id, input, signal, _update, ctx) {
        if (input.mutationVersion !== state.genericMutationVersion) throw new Error("Generic mutation verification is stale; verify the latest mutation version.");
        if (state.typedVerification?.mutationVersion === input.mutationVersion) throw new Error("Use framer_verify_typed_operation for this typed mutation; free-form JavaScript verification is reserved for framer_exec.");
        if (KNOWN_MUTATOR.test(input.assertion) || /\b(?:applyChanges|publish)\s*\(/u.test(input.assertion)) throw new Error("Generic mutation verification must be read-only.");
        const assertion = input.assertion.trim();
        if (/^(["'`])[\s\S]*\1$/u.test(assertion)) {
          throw new Error("Verification assertion is a string literal, not a boolean check. Example: (await framer.agent.getNode({ id: 'hero' }))?.name === 'Hero'.");
        }
        if (!/[()=!<>?.]|\b(?:await|true|false|Boolean)\b/u.test(assertion)) {
          throw new Error("Verification assertion looks like prose. Pass one read-only JavaScript expression returning boolean true.");
        }
        const source = `const verified = await (${input.assertion}); if (typeof verified !== "boolean") throw new Error("LOTTUS_ASSERTION_NON_BOOLEAN"); if (!verified) throw new Error("LOTTUS_ASSERTION_FALSE"); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify({ status: "verified" }));`;
        let executed: FramerExecutionResult;
        try {
          executed = await adapter.execute(source, { ...(signal ? { signal } : {}), timeoutMs: 120_000, workspaceRoot: ctx?.cwd ?? process.cwd() });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          if (message.includes("LOTTUS_ASSERTION_NON_BOOLEAN")) throw new Error("Verification assertion returned a non-boolean value; compare the read result to the expected state.");
          if (message.includes("LOTTUS_ASSERTION_FALSE")) throw new Error("Verification state check failed: the read completed but expected state was not present.");
          if (/typia|invalid (?:type|argument)|expected.*(?:object|id)|getNode/iu.test(message)) throw new Error("Verification used invalid Framer API arguments. Use await framer.agent.getNode({ id: 'node-id' }).");
          if (/unexpected|syntax|not defined|identifier/iu.test(message)) throw new Error("Verification assertion is not valid JavaScript. Pass one read-only boolean expression.");
          throw new Error(`Verification read failed: ${message.slice(0, 500)}`);
        }
        if (executed.observedEffect?.kind !== "read" || !executed.observedEffect.succeeded) {
          throw new Error("Completion evidence remains pending: the adapter did not observe a successful read-only verification.");
        }
        const result = extractStructuredResult(executed.rawOutput);
        if (typeof result !== "object" || result === null || (result as Record<string, unknown>).status !== "verified") {
          throw new Error("Completion evidence remains pending: the verification assertion returned invalid evidence.");
        }
        state.genericEvidenceVersion = state.genericMutationVersion;
        delete state.genericVerificationAction;
        return { content: [{ type: "text" as const, text: executed.visibleOutput }], details: { ...executed.details, expected: input.expected, mutationVersion: input.mutationVersion, observedEffect: executed.observedEffect } };
      },
    });

    pi.registerTool({
      name: "framer_apply_changes",
      label: "Apply Framer Changes",
      description: "Apply a focused typed Framer DSL change set to the Live Framer Session.",
      promptSnippet: "Apply a focused Framer DSL change set",
      parameters: Type.Object({
        dsl: Type.String({ minLength: 1, maxLength: 200_000 }),
        pagePath: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
        visualRisk: Type.Optional(StringEnum(["routine", "recreation", "major-page", "major-breakpoint", "absolute-positioning", "fixed-positioning", "reference-comparison", "deterministic-insufficient"] as const)),
      }, { additionalProperties: false }),
      executionMode: "sequential",
      async execute(_id, input, signal, _update, ctx) {
        state.canvasMutationVersion += 1;
        state.canvasEvidenceStatus = "incomplete";
        state.canvasDiagnostics = [];
        state.visualRequirement = input.visualRisk && input.visualRisk !== "routine" ? "screenshot" : "geometry";
        const source = `const result = await framer.agent.applyChanges(${JSON.stringify(input.dsl)}${input.pagePath ? `, { pagePath: ${JSON.stringify(input.pagePath)} }` : ""}); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify(result));`;
        const executed = await adapter.execute(source, { ...(signal ? { signal } : {}), timeoutMs: 120_000, workspaceRoot: ctx?.cwd ?? process.cwd() });
        const evidence = parseCanvasMutationEvidence(extractStructuredResult(executed.rawOutput));
        state.canvasEvidenceVersion = state.canvasMutationVersion;
        state.canvasEvidenceStatus = evidence.status;
        state.canvasDiagnostics = [...evidence.diagnostics];
        if (evidence.status !== "incomplete") state.geometryEvidenceVersion = state.canvasMutationVersion;
        const compact = serializeCanvasMutationEvidence(evidence);
        return {
          content: [{ type: "text" as const, text: compact }],
          details: {
            ...executed.details,
            effect: "mutate",
            mutationVersion: state.canvasMutationVersion,
            rawBytes: Buffer.byteLength(executed.rawOutput),
            visibleBytes: Buffer.byteLength(compact),
            evidence,
          },
        };
      },
    });
  };
}
