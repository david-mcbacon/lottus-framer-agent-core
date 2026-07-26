import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { parseCanvasMutationEvidence, serializeCanvasMutationEvidence } from "./canvas-evidence.js";
import { createFramerRunState, type FramerRunState } from "./framer-run-state.js";

export const FRAMER_RESULT_PREFIX = "[LOTTUS_FRAMER_RESULT_V1]";

export interface FramerRenderedOutput {
  readonly visibleOutput: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface FramerExecutionResult extends FramerRenderedOutput {
  readonly rawOutput: string;
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
  return /\bframer\s*\.\s*(?:createCodeFile|getCodeFile)\s*\(|\bsetFileContent\s*\(|\bCodeFile\s*\.\s*remove\s*\(/u.test(source);
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
        const timeoutMs = /startConversation\s*\(/u.test(input.source) ? 600_000 : 120_000;
        const executed = await adapter.execute(input.source, { ...(signal ? { signal } : {}), timeoutMs, workspaceRoot: ctx?.cwd ?? process.cwd() });
        if (input.effect === "publish" || /\.publish\s*\(/u.test(input.source)) state.published = true;
        return {
          content: [{ type: "text" as const, text: executed.visibleOutput }],
          details: { ...executed.details, effect: input.effect },
        };
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
      }, { additionalProperties: false }),
      executionMode: "sequential",
      async execute(_id, input, signal, _update, ctx) {
        state.canvasMutationVersion += 1;
        state.canvasEvidenceStatus = "incomplete";
        state.canvasDiagnostics = [];
        const source = `const result = await framer.agent.applyChanges(${JSON.stringify(input.dsl)}${input.pagePath ? `, { pagePath: ${JSON.stringify(input.pagePath)} }` : ""}); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify(result));`;
        const executed = await adapter.execute(source, { ...(signal ? { signal } : {}), timeoutMs: 120_000, workspaceRoot: ctx?.cwd ?? process.cwd() });
        const evidence = parseCanvasMutationEvidence(extractStructuredResult(executed.rawOutput));
        state.canvasEvidenceVersion = state.canvasMutationVersion;
        state.canvasEvidenceStatus = evidence.status;
        state.canvasDiagnostics = [...evidence.diagnostics];
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
