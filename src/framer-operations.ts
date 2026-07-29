import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { FRAMER_RESULT_PREFIX, type FramerExecutionAdapter } from "./framer-canvas.js";
import type { FramerRunState } from "./framer-run-state.js";

export const FRAMER_OPERATION_DETAILS_TYPE = "lottus_framer_operation" as const;
const MAX_RESULT_BYTES = 50_000;
const IDENTIFIER = Type.String({ minLength: 1, maxLength: 500 });

function extract(output: string): unknown {
  const lines = output.split(/\r?\n/u).filter((line) => line.startsWith(FRAMER_RESULT_PREFIX));
  if (lines.length !== 1) throw new Error("Framer operation returned invalid structured evidence");
  try { return JSON.parse(lines[0]!.slice(FRAMER_RESULT_PREFIX.length)); }
  catch { throw new Error("Framer operation returned malformed structured evidence"); }
}

function compact(value: unknown, budget = { remaining: 120 }): unknown {
  if (budget.remaining-- <= 0) return "[truncated]";
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => compact(item, budget));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 50).map(([key, item]) => [key, compact(item, budget)]));
}

function bounded(value: unknown): string {
  const text = JSON.stringify(compact(value));
  if (Buffer.byteLength(text) > MAX_RESULT_BYTES) throw new Error("Framer operation result exceeded the bounded output limit");
  return text;
}

function result(operation: string, value: unknown, extra: Record<string, unknown> = {}) {
  const details = compact({ type: FRAMER_OPERATION_DETAILS_TYPE, operation, result: value, ...extra }) as Record<string, unknown>;
  return { content: [{ type: "text" as const, text: bounded(details) }], details };
}

function exact(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`${label} must be an exact non-blank identifier without surrounding whitespace`);
  }
  return value;
}

function mutationPending(state: FramerRunState, action: string): number {
  state.genericMutationVersion += 1;
  state.genericVerificationAction = action;
  return state.genericMutationVersion;
}

async function run(adapter: FramerExecutionAdapter, source: string, signal: AbortSignal | undefined, cwd: string) {
  const execution = await adapter.execute(source, { ...(signal ? { signal } : {}), timeoutMs: 120_000, workspaceRoot: cwd });
  return { execution, value: extract(execution.rawOutput) };
}

const controlRequest = Type.Union([
  Type.Object({ kind: Type.Literal("component"), componentIds: Type.Array(IDENTIFIER, { minItems: 1, maxItems: 20, uniqueItems: true }) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("icon-set"), iconSetNames: Type.Array(IDENTIFIER, { minItems: 1, maxItems: 20, uniqueItems: true }) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("icons"), iconSetName: IDENTIFIER, match: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })), limit: Type.Integer({ minimum: 1, maximum: 100 }) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("layout-template"), layoutTemplateIds: Type.Array(IDENTIFIER, { minItems: 1, maxItems: 20, uniqueItems: true }) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("shader"), shaderNames: Type.Array(IDENTIFIER, { minItems: 1, maxItems: 20, uniqueItems: true }) }, { additionalProperties: false }),
]);

export function createFramerOperationsExtension(adapter: FramerExecutionAdapter, state: FramerRunState): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    pi.registerTool({
      name: "framer_read_node_context", label: "Read Explicit Framer Context",
      description: "Resolve one user-provided Context Picker node ID through a fresh bounded project read. Reports missing and changed-scope targets without guessing replacements.",
      promptSnippet: "Resolve an explicit Context Picker target before changing it",
      parameters: Type.Object({
        nodeId: IDENTIFIER,
        expectedScopeId: Type.Optional(IDENTIFIER),
        pagePath: Type.Optional(IDENTIFIER),
      }, { additionalProperties: false }),
      async execute(_id, input, signal, _update, ctx) {
        exact(input.nodeId, "Context Picker node ID");
        if (input.expectedScopeId) exact(input.expectedScopeId, "Context Picker scope ID");
        if (input.pagePath) exact(input.pagePath, "Context Picker page path");
        const options = input.pagePath ? `, { pagePath: ${JSON.stringify(input.pagePath)} }` : "";
        const source = `const target = ${JSON.stringify(input)}; const node = await framer.agent.getNode({ id: target.nodeId }${options}); if (!node) { console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify({ status: "not_found", nodeId: target.nodeId, action: "ask the user to paste the intended layer with Context Picker again" })); } else { const [serialized, parent, scope, rect] = await Promise.all([framer.agent.serialize({ id: target.nodeId, depth: 2, ancestorPath: true }${options}), framer.agent.getParentNode({ id: target.nodeId }${options}), framer.agent.getScopeNode({ id: target.nodeId }${options}), framer.agent.getRect({ id: target.nodeId }${options})]); const status = target.expectedScopeId && scope?.id !== target.expectedScopeId ? "scope_mismatch" : "found"; console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify({ status, nodeId: target.nodeId, expectedScopeId: target.expectedScopeId, actualScopeId: scope?.id, node: serialized, parent: parent ? { id: parent.id, name: parent.name, type: parent.type } : null, scope: scope ? { id: scope.id, name: scope.name, type: scope.type } : null, rect, ...(status === "scope_mismatch" ? { action: "ask the user to paste the intended layer with Context Picker again; do not substitute another node" } : {}) })); }`;
        const { execution, value } = await run(adapter, source, signal, ctx?.cwd ?? process.cwd());
        return result("read-node-context", value, { ...execution.details, explicitUserContext: true });
      },
    });

    pi.registerTool({
      name: "framer_read_controls", label: "Read Framer Controls",
      description: "Batch exact component, icon-set, icon-catalog, layout-template, and shader metadata reads in one bounded operation.",
      promptSnippet: "Batch exact Framer control and catalog reads",
      parameters: Type.Object({ requests: Type.Array(controlRequest, { minItems: 1, maxItems: 20 }) }, { additionalProperties: false }),
      async execute(_id, input, signal, _update, ctx) {
        for (const request of input.requests) {
          if (request.kind === "component") request.componentIds.forEach((id) => exact(id, "Component ID"));
          else if (request.kind === "icon-set") request.iconSetNames.forEach((name) => exact(name, "Icon-set name"));
          else if (request.kind === "icons") exact(request.iconSetName, "Icon-set name");
          else if (request.kind === "layout-template") request.layoutTemplateIds.forEach((id) => exact(id, "Layout-template ID"));
          else request.shaderNames.forEach((name) => exact(name, "Shader name"));
        }
        const requests = JSON.stringify(input.requests);
        const source = `const requests = ${requests}; const results = await Promise.all(requests.map(async (request) => { switch (request.kind) { case "component": return { kind: request.kind, identifiers: request.componentIds, value: await framer.agent.readComponentControls({ componentIds: request.componentIds }) }; case "icon-set": return { kind: request.kind, identifiers: request.iconSetNames, value: await framer.agent.readIconSetControls({ iconSetNames: request.iconSetNames }) }; case "icons": { const icons = await framer.agent.readIcons({ iconSetName: request.iconSetName }); const match = request.match?.toLocaleLowerCase(); const matches = (Array.isArray(icons) ? icons : []).filter((name) => typeof name === "string" && (!match || name.toLocaleLowerCase().includes(match))).slice(0, request.limit); return { kind: request.kind, identifier: request.iconSetName, matches, truncated: matches.length === request.limit }; } case "layout-template": return { kind: request.kind, identifiers: request.layoutTemplateIds, value: await framer.agent.readLayoutTemplateControls({ layoutTemplateIds: request.layoutTemplateIds }) }; case "shader": return { kind: request.kind, identifiers: request.shaderNames, value: await framer.agent.readShaderControls({ shaderNames: request.shaderNames }) }; } })); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify(results));`;
        const { execution, value } = await run(adapter, source, signal, ctx?.cwd ?? process.cwd());
        return result("read-controls", value, { ...execution.details, requestCount: input.requests.length });
      },
    });

    pi.registerTool({
      name: "framer_replace_text", label: "Replace Framer Text",
      description: "Replace exact text through Framer's formatting-preserving public operation and create pending mutation review evidence.",
      parameters: Type.Object({ id: IDENTIFIER, searchText: Type.String({ minLength: 1, maxLength: 20_000 }), replaceText: Type.String({ maxLength: 20_000 }), pagePath: Type.Optional(IDENTIFIER) }, { additionalProperties: false }),
      executionMode: "sequential",
      async execute(_id, input, signal, _update, ctx) {
        exact(input.id, "Text node ID");
        const source = `const replaced = await framer.agent.replaceText(${JSON.stringify({ id: input.id, searchText: input.searchText, replaceText: input.replaceText })}${input.pagePath ? `, { pagePath: ${JSON.stringify(input.pagePath)} }` : ""}); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify({ status: replaced ? "success" : "not_found", replaced }));`;
        const { execution, value } = await run(adapter, source, signal, ctx?.cwd ?? process.cwd());
        const record = value as Record<string, unknown>;
        const version = record.replaced === true ? mutationPending(state, "verify the formatting-preserving text replacement with framer_verify_mutation") : undefined;
        return result("replace-text", value, { ...execution.details, ...(version ? { mutationVersion: version } : {}) });
      },
    });

    pi.registerTool({
      name: "framer_query_analytics", label: "Query Framer Analytics",
      description: "Run one bounded read-only analytics query for a validated ISO date range.",
      parameters: Type.Object({ query: Type.String({ minLength: 1, maxLength: 8_000 }), from: Type.String({ minLength: 10, maxLength: 40 }), to: Type.Optional(Type.String({ minLength: 10, maxLength: 40 })) }, { additionalProperties: false }),
      async execute(_id, input, signal, _update, ctx) {
        const sql = input.query.trim();
        if (!/^(?:SELECT|WITH)\b/iu.test(sql) || /;|\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|ATTACH|DETACH|OPTIMIZE|SYSTEM)\b/iu.test(sql)) throw new Error("Analytics query must be one read-only SELECT/WITH statement");
        if (/SELECT\s+\*/iu.test(sql)) throw new Error("Analytics query must select bounded fields, not SELECT *");
        const from = new Date(input.from); const to = input.to ? new Date(input.to) : new Date();
        if (!Number.isFinite(from.valueOf()) || !Number.isFinite(to.valueOf()) || to <= from) throw new Error("Analytics date range must use valid increasing ISO dates");
        if (to.valueOf() - from.valueOf() > 366 * 86_400_000) throw new Error("Analytics date range cannot exceed 366 days");
        const source = `const rows = await framer.agent.queryAnalytics(${JSON.stringify(input)}); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify({ rows: Array.isArray(rows) ? rows.slice(0, 1000) : [], truncated: Array.isArray(rows) && rows.length > 1000 }));`;
        const { execution, value } = await run(adapter, source, signal, ctx?.cwd ?? process.cwd());
        return result("query-analytics", value, { ...execution.details, readOnly: true });
      },
    });

    pi.registerTool({
      name: "framer_flatten_component", label: "Flatten Framer Component",
      description: "Flatten one exact local component instance through Framer's public operation.",
      parameters: Type.Object({ id: IDENTIFIER }, { additionalProperties: false }), executionMode: "sequential",
      async execute(_id, input, signal, _update, ctx) {
        exact(input.id, "Component instance ID");
        const source = `const value = await framer.agent.flattenComponentInstance(${JSON.stringify({ id: input.id })}); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify(value));`;
        const { execution, value } = await run(adapter, source, signal, ctx?.cwd ?? process.cwd());
        const version = (value as Record<string, unknown>)?.status === "success" ? mutationPending(state, "verify the flattened component layers with framer_verify_mutation") : undefined;
        return result("flatten-component", value, { ...execution.details, ...(version ? { mutationVersion: version } : {}) });
      },
    });

    pi.registerTool({
      name: "framer_make_component_local", label: "Make Framer Component Local",
      description: "Make one exact external component instance local; pass replaceAll only after explicit one-versus-all scope is known.",
      parameters: Type.Object({ id: IDENTIFIER, replaceAll: Type.Optional(Type.Boolean()) }, { additionalProperties: false }), executionMode: "sequential",
      async execute(_id, input, signal, _update, ctx) {
        exact(input.id, "Component instance ID");
        const source = `const value = await framer.agent.makeExternalComponentLocal(${JSON.stringify(input)}); console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify(value));`;
        const { execution, value } = await run(adapter, source, signal, ctx?.cwd ?? process.cwd());
        const record = value as Record<string, unknown>;
        if (record?.status === "needs_confirmation" && input.replaceAll !== undefined) throw new Error("Framer still requires one-versus-all confirmation");
        const version = record?.status === "success" ? mutationPending(state, "verify the localized component instance with framer_verify_mutation") : undefined;
        return result("make-component-local", value, { ...execution.details, ...(version ? { mutationVersion: version } : {}) });
      },
    });
  };
}
