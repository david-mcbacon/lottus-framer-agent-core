import { createHash, randomUUID } from "node:crypto";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { FRAMER_RESULT_PREFIX, type FramerExecutionAdapter } from "./framer-canvas.js";
import {
  recordCodeMutation,
  recordCodeVerification,
  type CodeVerificationStatus,
  type FramerRunState,
} from "./framer-run-state.js";

export const MAX_CODE_FILE_SOURCE_BYTES = 200_000;
export const MAX_CODE_DISCOVERY_FILES = 100;
export const FRAMER_CODE_FILE_DETAILS_TYPE = "lottus_framer_code_file" as const;
const CODE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(?:tsx?|jsx?)$/u;
const MAX_VISIBLE_EVIDENCE_BYTES = 50_000;

export type ExpectedExport = "component" | "override" | "any";

export interface FramerScratchFileAdapter {
  /** Read model-authored source after applying host path policy and the supplied byte limit. */
  readSource(sourcePath: string, maxBytes: number, options: { readonly workspaceRoot: string }): Promise<string>;
  /** Write a complete model-readable snapshot and return its host-scoped path. */
  writeSnapshot(name: string, content: string, options: { readonly workspaceRoot: string }): Promise<string>;
}

export interface NormalizedCodeExport {
  readonly type: string;
  readonly name?: string;
  readonly isDefaultExport: boolean;
  readonly componentId?: string;
}

export interface CodeFileEvidence {
  kind: "ok" | "not_found" | "exists" | "conflict";
  mutated: boolean;
  verificationComplete: boolean;
  verificationError?: string;
  id?: string;
  name?: string;
  path?: string;
  content?: string;
  exports: NormalizedCodeExport[];
  diagnostics: unknown[];
}

export interface CodeFileResultDetails {
  readonly type: typeof FRAMER_CODE_FILE_DETAILS_TYPE;
  readonly status: CodeFileEvidence["kind"];
  readonly mutationSucceeded: boolean;
  readonly verificationComplete?: boolean;
  readonly verificationStatus?: "complete" | "issues" | "incomplete";
  readonly verificationError?: string;
  readonly scratchPath?: string;
  readonly snapshotToken?: string;
  readonly contentHash?: string;
  readonly byteSize?: number;
  readonly exports?: readonly NormalizedCodeExport[];
  readonly diagnostics?: readonly unknown[];
  readonly exportDiagnostic?: string;
  readonly instruction?: string;
  readonly branchChanges?: readonly string[];
}

interface Snapshot {
  readonly name: string;
  readonly content: string;
  readonly hash: string;
}

export function validateCodeFileName(name: string): string {
  if (!CODE_FILE_NAME.test(name)) {
    throw new Error("Code-file name must be a single .ts, .tsx, .js, or .jsx filename without directories");
  }
  return name;
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 20) return false;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length <= 10_000 && value.every((item) => isJsonValue(item, depth + 1));
  return typeof value === "object" && Object.keys(value as object).length <= 1_000
    && Object.entries(value as Record<string, unknown>).every(([key, item]) => key.length <= 500 && isJsonValue(item, depth + 1));
}

export function parseCodeFileEvidence(value: unknown): CodeFileEvidence {
  if (!value || typeof value !== "object") throw new Error("Framer code-file operation returned invalid evidence");
  const input = value as Record<string, unknown>;
  if (!( ["ok", "not_found", "exists", "conflict"] as unknown[]).includes(input.kind)) {
    throw new Error("Framer code-file operation returned an invalid result kind");
  }
  if (typeof input.mutated !== "boolean" || typeof input.verificationComplete !== "boolean") {
    throw new Error("Framer code-file operation omitted mutation evidence");
  }
  for (const key of ["verificationError", "id", "name", "path", "content"] as const) {
    if (input[key] !== undefined && typeof input[key] !== "string") throw new Error(`Framer code-file operation returned invalid ${key}`);
  }
  if (!Array.isArray(input.exports) || !Array.isArray(input.diagnostics) || !isJsonValue(input.diagnostics)) {
    throw new Error("Framer code-file operation returned invalid diagnostics");
  }
  const exports = input.exports.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Framer code-file operation returned an invalid export");
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.type !== "string" || typeof candidate.isDefaultExport !== "boolean") {
      throw new Error("Framer code-file operation returned an invalid export");
    }
    if (candidate.name !== undefined && typeof candidate.name !== "string") throw new Error("Framer code-file operation returned an invalid export name");
    if (candidate.componentId !== undefined && typeof candidate.componentId !== "string") throw new Error("Framer code-file operation returned an invalid component ID");
    return {
      type: candidate.type,
      ...(typeof candidate.name === "string" ? { name: candidate.name } : {}),
      isDefaultExport: candidate.isDefaultExport,
      ...(typeof candidate.componentId === "string" ? { componentId: candidate.componentId } : {}),
    };
  });
  return {
    kind: input.kind as CodeFileEvidence["kind"],
    mutated: input.mutated,
    verificationComplete: input.verificationComplete,
    ...(typeof input.verificationError === "string" ? { verificationError: input.verificationError } : {}),
    ...(typeof input.id === "string" ? { id: input.id } : {}),
    ...(typeof input.name === "string" ? { name: input.name } : {}),
    ...(typeof input.path === "string" ? { path: input.path } : {}),
    ...(typeof input.content === "string" ? { content: input.content } : {}),
    exports,
    diagnostics: input.diagnostics,
  };
}

function extractCodeFileEvidence(output: string): CodeFileEvidence {
  const marked = output.split(/\r?\n/u).filter((line) => line.startsWith(FRAMER_RESULT_PREFIX));
  if (marked.length !== 1) throw new Error("Framer code-file operation returned invalid structured evidence");
  let value: unknown;
  try { value = JSON.parse(marked[0]!.slice(FRAMER_RESULT_PREFIX.length)); }
  catch { throw new Error("Framer code-file operation returned malformed structured evidence"); }
  return parseCodeFileEvidence(value);
}

function extractDiscoveryEvidence(output: string): unknown {
  const marked = output.split(/\r?\n/u).filter((line) => line.startsWith(FRAMER_RESULT_PREFIX));
  if (marked.length !== 1) throw new Error("Framer code discovery returned invalid structured evidence");
  try { return JSON.parse(marked[0]!.slice(FRAMER_RESULT_PREFIX.length)); }
  catch { throw new Error("Framer code discovery returned malformed structured evidence"); }
}

function relayHelpers(): string {
  return `
const __lottusNormalizeExports = (items) => Array.isArray(items) ? items.map((item) => ({
  type: typeof item?.type === "string" ? item.type : "unknown",
  name: typeof item?.name === "string" ? item.name : undefined,
  isDefaultExport: item?.isDefaultExport === true,
  componentId: typeof item?.componentId === "string" ? item.componentId : undefined,
})) : [];
const __lottusInspect = async (file, mutated) => {
  const base = {
    kind: "ok", mutated,
    id: typeof file?.id === "string" ? file.id : undefined,
    name: typeof file?.name === "string" ? file.name : undefined,
    path: typeof file?.path === "string" ? file.path : undefined,
    content: typeof file?.content === "string" ? file.content : undefined,
    exports: __lottusNormalizeExports(file?.exports), diagnostics: [], verificationComplete: false,
  };
  try {
    const diagnostics = await file.typecheck();
    base.diagnostics = Array.isArray(diagnostics) ? diagnostics : diagnostics == null ? [] : [diagnostics];
    base.verificationComplete = true;
  } catch (error) {
    base.verificationError = error instanceof Error ? error.message : String(error);
  }
  return base;
};
const __lottusEmit = (value) => console.log(${JSON.stringify(FRAMER_RESULT_PREFIX)} + JSON.stringify(value));
`;
}

function readScript(name: string): string {
  return `${relayHelpers()}
let file;
try { file = await framer.getCodeFile(${JSON.stringify(name)}); } catch {}
if (!file) __lottusEmit({ kind: "not_found", mutated: false, verificationComplete: false, exports: [], diagnostics: [] });
else __lottusEmit(await __lottusInspect(file, false));`;
}

function createScript(name: string, source: string): string {
  return `${relayHelpers()}
let existing;
try { existing = await framer.getCodeFile(${JSON.stringify(name)}); } catch {}
if (existing) __lottusEmit({ kind: "exists", mutated: false, verificationComplete: false, exports: [], diagnostics: [] });
else __lottusEmit(await __lottusInspect(await framer.createCodeFile(${JSON.stringify(name)}, ${JSON.stringify(source)}), true));`;
}

function updateScript(name: string, expectedContent: string, source: string): string {
  return `${relayHelpers()}
let file;
try { file = await framer.getCodeFile(${JSON.stringify(name)}); } catch {}
if (!file) __lottusEmit({ kind: "not_found", mutated: false, verificationComplete: false, exports: [], diagnostics: [] });
else if (file.content !== ${JSON.stringify(expectedContent)}) __lottusEmit({ kind: "conflict", mutated: false, verificationComplete: false, exports: [], diagnostics: [] });
else __lottusEmit(await __lottusInspect(await file.setFileContent(${JSON.stringify(source)}), true));`;
}

function discoveryScript(search?: { query: string; maxMatches: number; contextChars: number }): string {
  return `const files = await framer.getCodeFiles();
const boundedFiles = (Array.isArray(files) ? files : []).slice(0, ${MAX_CODE_DISCOVERY_FILES});
const normalized = boundedFiles.map((file) => ({
  name: typeof file?.name === "string" ? file.name : undefined,
  path: typeof file?.path === "string" ? file.path : undefined,
  byteSize: typeof file?.content === "string" ? new TextEncoder().encode(file.content).length : undefined,
  exports: __lottusNormalizeExports(file?.exports).slice(0, 20),
})).filter((file) => typeof file.name === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\\.(?:tsx?|jsx?)$/.test(file.name));
${search ? `const needle = ${JSON.stringify(search.query.toLocaleLowerCase())};
const matches = [];
for (const file of boundedFiles) {
  if (typeof file?.name !== "string" || typeof file?.content !== "string" || new TextEncoder().encode(file.content).length > ${MAX_CODE_FILE_SOURCE_BYTES}) continue;
  const lower = file.content.toLocaleLowerCase(); let offset = 0;
  while (matches.length < ${search.maxMatches} && (offset = lower.indexOf(needle, offset)) !== -1) {
    const start = Math.max(0, offset - ${search.contextChars}); const end = Math.min(file.content.length, offset + needle.length + ${search.contextChars});
    matches.push({ name: file.name, offset, snippet: file.content.slice(start, end) }); offset += Math.max(1, needle.length);
  }
  if (matches.length >= ${search.maxMatches}) break;
}
__lottusEmit({ filesScanned: normalized.length, matches, truncated: matches.length === ${search.maxMatches} || (Array.isArray(files) && files.length > ${MAX_CODE_DISCOVERY_FILES}) });`
    : `__lottusEmit({ files: normalized, truncated: Array.isArray(files) && files.length > ${MAX_CODE_DISCOVERY_FILES} });`}`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function exportDiagnostic(exports: readonly NormalizedCodeExport[], expected: ExpectedExport): string | undefined {
  if (expected === "component" && !exports.some((item) => item.type === "component" && item.isDefaultExport && item.componentId)) {
    return "Expected a default component export with a component ID, but none was found.";
  }
  if (expected === "override" && !exports.some((item) => item.type === "override")) {
    return "Expected a code override export, but none was found.";
  }
  return undefined;
}

function publicEvidence(
  evidence: CodeFileEvidence,
  status: CodeVerificationStatus,
  snapshot?: { path: string; token: string; hash: string },
  diagnostic?: string,
  controlOutput?: string,
): CodeFileResultDetails {
  const branchChanges = controlOutput?.split(/\r?\n/u).filter((line) => line.startsWith("[FRAMER_BRANCH_CHANGE]"));
  return {
    type: FRAMER_CODE_FILE_DETAILS_TYPE,
    status: evidence.kind,
    mutationSucceeded: evidence.mutated,
    verificationComplete: evidence.verificationComplete,
    verificationStatus: status === "clean" ? "complete" : status,
    ...(evidence.verificationError ? { verificationError: evidence.verificationError } : {}),
    ...(snapshot ? { scratchPath: snapshot.path, snapshotToken: snapshot.token, contentHash: snapshot.hash } : {}),
    ...(evidence.content !== undefined ? { byteSize: Buffer.byteLength(evidence.content) } : {}),
    exports: evidence.exports,
    diagnostics: evidence.diagnostics,
    ...(diagnostic ? { exportDiagnostic: diagnostic } : {}),
    ...(branchChanges?.length ? { branchChanges } : {}),
  };
}

function textResult(details: CodeFileResultDetails) {
  const full = JSON.stringify(details, null, 2);
  const visible = Buffer.byteLength(full) <= MAX_VISIBLE_EVIDENCE_BYTES
    ? full
    : `${Buffer.from(full).subarray(0, MAX_VISIBLE_EVIDENCE_BYTES).toString("utf8")}\n\n[Visible evidence truncated; exact structured details remain available.]`;
  return { content: [{ type: "text" as const, text: visible }], details };
}

export function createFramerCodeFilesExtension(input: {
  executionAdapter: FramerExecutionAdapter;
  scratchAdapter: FramerScratchFileAdapter;
  state: FramerRunState;
}): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    // Tokens and source snapshots are deliberately scoped to this Pi extension registration/session.
    const snapshots = new Map<string, Snapshot>();
    const saveSnapshot = async (name: string, content: string, workspaceRoot: string) => {
      if (Buffer.byteLength(content) > MAX_CODE_FILE_SOURCE_BYTES) throw new Error("Remote code file exceeds the supported source-size limit");
      const hash = sha256(content);
      const token = randomUUID();
      const path = await input.scratchAdapter.writeSnapshot(name, content, { workspaceRoot });
      snapshots.set(token, { name, content, hash });
      return { path, token, hash };
    };
    const run = async (source: string, signal: AbortSignal | undefined, workspaceRoot: string) => {
      const execution = await input.executionAdapter.execute(source, {
        ...(signal ? { signal } : {}), timeoutMs: 120_000, workspaceRoot,
      });
      return { execution, evidence: extractCodeFileEvidence(execution.rawOutput) };
    };
    const requireContent = (evidence: CodeFileEvidence): string => {
      if (evidence.kind !== "ok" || typeof evidence.content !== "string") throw new Error("Framer code-file evidence did not include complete source content");
      return evidence.content;
    };

    const discover = async (source: string, signal: AbortSignal | undefined, workspaceRoot: string) => {
      const execution = await input.executionAdapter.execute(`${relayHelpers()}\n${source}`, {
        ...(signal ? { signal } : {}), timeoutMs: 120_000, workspaceRoot,
      });
      return { execution, evidence: extractDiscoveryEvidence(execution.rawOutput) };
    };

    pi.registerTool({
      name: "framer_list_code_files", label: "List Framer Code Files",
      description: "List bounded Framer Project code-file metadata without requiring a known filename or returning source.",
      parameters: Type.Object({}, { additionalProperties: false }),
      async execute(_id, _params, signal, _update, ctx) {
        const { execution, evidence } = await discover(discoveryScript(), signal, ctx?.cwd ?? process.cwd());
        const details = { type: FRAMER_CODE_FILE_DETAILS_TYPE, status: "ok" as const, mutationSucceeded: false, discovery: evidence, ...execution.details };
        return { content: [{ type: "text" as const, text: JSON.stringify(details) }], details };
      },
    });

    pi.registerTool({
      name: "framer_search_code_files", label: "Search Framer Code Files",
      description: "Search bounded source snippets across Framer Project code files. Use exact read before editing a discovered file.",
      parameters: Type.Object({ query: Type.String({ minLength: 2, maxLength: 200 }), maxMatches: Type.Integer({ minimum: 1, maximum: 50 }), contextChars: Type.Optional(Type.Integer({ minimum: 0, maximum: 200 })) }, { additionalProperties: false }),
      async execute(_id, params, signal, _update, ctx) {
        const query = params.query.trim();
        if (query !== params.query || /[\u0000-\u001f\u007f]/u.test(query)) throw new Error("Code search query must be exact text without surrounding whitespace or control characters");
        const { execution, evidence } = await discover(discoveryScript({ query, maxMatches: params.maxMatches, contextChars: params.contextChars ?? 80 }), signal, ctx?.cwd ?? process.cwd());
        const details = { type: FRAMER_CODE_FILE_DETAILS_TYPE, status: "ok" as const, mutationSucceeded: false, discovery: evidence, ...execution.details };
        return { content: [{ type: "text" as const, text: JSON.stringify(details) }], details };
      },
    });

    pi.registerTool({
      name: "framer_read_code_file", label: "Read Framer Code File",
      description: "Read and typecheck one Framer code file, then place its complete source in a scoped scratch file.",
      promptSnippet: "Read a Framer code file into a safe scratch snapshot before editing",
      parameters: Type.Object({ name: Type.String({ minLength: 1, maxLength: 140 }), purpose: Type.Optional(Type.String({ minLength: 1, maxLength: 240 })) }, { additionalProperties: false }),
      executionMode: "sequential",
      async execute(_id, params, signal, _update, ctx) {
        const name = validateCodeFileName(params.name);
        const workspaceRoot = ctx?.cwd ?? process.cwd();
        const { execution, evidence } = await run(readScript(name), signal, workspaceRoot);
        if (evidence.kind === "not_found") return textResult({
          type: FRAMER_CODE_FILE_DETAILS_TYPE, status: "not_found", mutationSucceeded: false,
          instruction: "No code file with that exact name exists. For a new component, author source under .lottus/work/code-components/ and call framer_create_code_file.",
        });
        const snapshot = await saveSnapshot(name, requireContent(evidence), workspaceRoot);
        const recorded = recordCodeVerification(input.state, name, { complete: evidence.verificationComplete, diagnostics: evidence.diagnostics, contentHash: snapshot.hash });
        return textResult(publicEvidence(evidence, recorded.verificationStatus, snapshot, undefined, execution.visibleOutput));
      },
    });

    pi.registerTool({
      name: "framer_create_code_file", label: "Create Framer Code File",
      description: "Create and verify a new Framer code file. First use write to author source at .lottus/work/code-components/<Name>.tsx, then pass that exact path. Never use .lottus/framer/scratch or Bash. Existing files are not overwritten.",
      promptSnippet: "Create and verify a Framer code file from source authored under .lottus/work/code-components/",
      parameters: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 140, description: "Single Framer filename, for example NeonLamps.tsx" }),
        sourcePath: Type.String({ minLength: 1, maxLength: 1000, description: "Existing source authored with write under .lottus/work/code-components/" }),
        purpose: Type.String({ minLength: 1, maxLength: 240 }), expectedExport: StringEnum(["component", "override", "any"] as const),
      }, { additionalProperties: false }),
      executionMode: "sequential",
      async execute(_id, params, signal, _update, ctx) {
        const name = validateCodeFileName(params.name);
        const workspaceRoot = ctx?.cwd ?? process.cwd();
        const source = await input.scratchAdapter.readSource(params.sourcePath, MAX_CODE_FILE_SOURCE_BYTES, { workspaceRoot });
        const { execution, evidence } = await run(createScript(name, source), signal, workspaceRoot);
        if (evidence.kind === "exists") throw new Error("Creation refused because that Framer code file already exists. Read it and use framer_update_code_file instead.");
        if (!evidence.mutated) throw new Error("Framer code-file creation did not mutate the Project");
        recordCodeMutation(input.state, name);
        const diagnostic = exportDiagnostic(evidence.exports, params.expectedExport);
        let snapshot: { path: string; token: string; hash: string } | undefined;
        try { snapshot = await saveSnapshot(name, requireContent(evidence), workspaceRoot); }
        catch (error) {
          evidence.verificationComplete = false;
          evidence.verificationError = error instanceof Error ? error.message : "Snapshot creation failed";
        }
        const recorded = recordCodeVerification(input.state, name, { complete: evidence.verificationComplete, diagnostics: evidence.diagnostics, ...(diagnostic ? { exportDiagnostic: diagnostic } : {}), ...(snapshot ? { contentHash: snapshot.hash } : {}) });
        return textResult(publicEvidence(evidence, recorded.verificationStatus, snapshot, diagnostic, execution.visibleOutput));
      },
    });

    pi.registerTool({
      name: "framer_update_code_file", label: "Update Framer Code File",
      description: "Update a Framer code file only when its remote source still exactly matches a run-local snapshot. Edit the scratch path returned by read/create/check and pass that exact path and token.",
      promptSnippet: "Safely update and verify a previously read Framer code file",
      parameters: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 140 }),
        sourcePath: Type.String({ minLength: 1, maxLength: 1000, description: "Exact scratch path returned by the latest read, create, or check" }),
        snapshotToken: Type.String({ minLength: 1, maxLength: 100, description: "Opaque token returned with that same scratch path" }),
        purpose: Type.String({ minLength: 1, maxLength: 240 }), expectedExport: StringEnum(["component", "override", "any"] as const),
      }, { additionalProperties: false }),
      executionMode: "sequential",
      async execute(_id, params, signal, _update, ctx) {
        const name = validateCodeFileName(params.name);
        const before = snapshots.get(params.snapshotToken);
        if (!before || before.name !== name) throw new Error("Snapshot token is missing or expired. Read the code file again before updating it.");
        const workspaceRoot = ctx?.cwd ?? process.cwd();
        const source = await input.scratchAdapter.readSource(params.sourcePath, MAX_CODE_FILE_SOURCE_BYTES, { workspaceRoot });
        const { execution, evidence } = await run(updateScript(name, before.content, source), signal, workspaceRoot);
        if (evidence.kind === "conflict") return textResult({
          type: FRAMER_CODE_FILE_DETAILS_TYPE, status: "conflict", mutationSucceeded: false,
          instruction: "The remote code file changed after the snapshot. Re-read it, reapply the edit, and retry.",
          branchChanges: execution.visibleOutput.split(/\r?\n/u).filter((line) => line.startsWith("[FRAMER_BRANCH_CHANGE]")),
        });
        if (evidence.kind === "not_found") throw new Error("The Framer code file no longer exists. No update was made.");
        if (!evidence.mutated) throw new Error("Framer code-file update did not mutate the Project");
        recordCodeMutation(input.state, name);
        const diagnostic = exportDiagnostic(evidence.exports, params.expectedExport);
        let snapshot: { path: string; token: string; hash: string } | undefined;
        try { snapshot = await saveSnapshot(name, requireContent(evidence), workspaceRoot); }
        catch (error) {
          evidence.verificationComplete = false;
          evidence.verificationError = error instanceof Error ? error.message : "Snapshot creation failed";
        }
        const recorded = recordCodeVerification(input.state, name, { complete: evidence.verificationComplete, diagnostics: evidence.diagnostics, ...(diagnostic ? { exportDiagnostic: diagnostic } : {}), ...(snapshot ? { contentHash: snapshot.hash } : {}) });
        return textResult(publicEvidence(evidence, recorded.verificationStatus, snapshot, diagnostic, execution.visibleOutput));
      },
    });

    pi.registerTool({
      name: "framer_check_code_file", label: "Check Framer Code File",
      description: "Re-read, typecheck, and validate exports for one Framer code file, refreshing its scoped scratch snapshot.",
      promptSnippet: "Check current Framer code-file diagnostics and exports",
      parameters: Type.Object({ name: Type.String({ minLength: 1, maxLength: 140 }), expectedExport: StringEnum(["component", "override", "any"] as const) }, { additionalProperties: false }),
      executionMode: "sequential",
      async execute(_id, params, signal, _update, ctx) {
        const name = validateCodeFileName(params.name);
        const workspaceRoot = ctx?.cwd ?? process.cwd();
        const { execution, evidence } = await run(readScript(name), signal, workspaceRoot);
        if (evidence.kind === "not_found") throw new Error(`Framer code file ${name} was not found`);
        const diagnostic = exportDiagnostic(evidence.exports, params.expectedExport);
        const snapshot = await saveSnapshot(name, requireContent(evidence), workspaceRoot);
        const recorded = recordCodeVerification(input.state, name, { complete: evidence.verificationComplete, diagnostics: evidence.diagnostics, ...(diagnostic ? { exportDiagnostic: diagnostic } : {}), contentHash: snapshot.hash });
        return textResult(publicEvidence(evidence, recorded.verificationStatus, snapshot, diagnostic, execution.visibleOutput));
      },
    });
  };
}
