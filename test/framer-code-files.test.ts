import { describe, expect, it } from "vitest";
import {
  MAX_CODE_FILE_SOURCE_BYTES,
  createFramerAgentCoreExtension,
  parseCodeFileEvidence,
  type FramerExecutionAdapter,
  type FramerScratchFileAdapter,
  type FramerRunState,
} from "../src/index.js";
import { captureExtensionTools, requireCapturedTool } from "../src/testing.js";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;

function harness() {
  const remote = new Map<string, any>();
  const local = new Map<string, string>();
  const snapshots = new Map<string, string>();
  const createCalls: unknown[][] = [];
  let snapshotCounter = 0;
  const framer = {
    async getCodeFiles() { return [...remote.values()]; },
    async getCodeFile(name: string) {
      const file = remote.get(name);
      if (!file) throw new Error("missing");
      return file;
    },
    async createCodeFile(...args: unknown[]) {
      createCalls.push(args);
      const [name, content] = args as [string, string];
      const file: any = {
        id: `id-${name}`, name, path: name, content,
        exports: [{ type: "component", name: "Default", isDefaultExport: true, componentId: `component-${name}` }],
        diagnostics: [] as unknown[],
        async typecheck() { if (file.typecheckError) throw new Error("transport down"); return file.diagnostics; },
        async setFileContent(next: string) { file.content = next; file.setCalls = (file.setCalls ?? 0) + 1; return file; },
      };
      remote.set(name, file);
      return file;
    },
  };
  const executionAdapter: FramerExecutionAdapter = {
    async docs() { return { visibleOutput: "docs" }; },
    async execute(source) {
      const lines: string[] = [];
      await new AsyncFunction("framer", "console", source)(framer, { log: (value: unknown) => lines.push(String(value)) });
      const output = lines.join("\n");
      return { rawOutput: output, visibleOutput: output || "(no output)" };
    },
  };
  const scratchAdapter: FramerScratchFileAdapter = {
    async readSource(sourcePath, maxBytes) {
      const value = local.get(sourcePath);
      if (value === undefined) throw new Error("missing source");
      if (Buffer.byteLength(value) > maxBytes) throw new Error("byte limit");
      return value;
    },
    async writeSnapshot(_name, content) {
      const path = `.lottus/work/code-components/.snapshots/snapshot-${++snapshotCounter}.tsx`;
      snapshots.set(path, content);
      return path;
    },
  };
  let state: FramerRunState | undefined;
  const tools = captureExtensionTools(createFramerAgentCoreExtension({
    executionAdapter,
    scratchAdapter,
    onSessionStateCreated(value) { state = value; },
  }));
  return { remote, local, snapshots, createCalls, executionAdapter, scratchAdapter, tools, get state() { return state!; } };
}

const componentInput = (sourcePath: string) => ({ name: "Card.tsx", sourcePath, purpose: "Implement card", expectedExport: "component" }) as never;

async function execute(h: ReturnType<typeof harness>, name: string, input: unknown) {
  return await requireCapturedTool(h.tools, name).execute(name, input as never) as any;
}

describe("Framer code-file Core conformance", () => {
  it("registers the complete canonical tool catalog once when both adapters are supplied", () => {
    const h = harness();
    expect([...h.tools.keys()].sort()).toEqual([
      "ask_user",
      "finish_framer_work",
      "framer_apply_changes",
      "framer_check_code_file",
      "framer_create_code_file",
      "framer_docs",
      "framer_exec",
      "framer_flatten_component",
      "framer_get_guides",
      "framer_list_code_files",
      "framer_make_component_local",
      "framer_publish",
      "framer_query_analytics",
      "framer_read_code_file",
      "framer_read_controls",
      "framer_replace_text",
      "framer_search_code_files",
      "framer_search_fonts",
      "framer_update_code_file",
      "framer_verify_mutation",
    ]);
  });

  it("lists metadata and searches bounded source before exact reads", async () => {
    const h = harness();
    h.local.set("source.tsx", "export default function Card(){ return <div>Needle value</div> }");
    await execute(h, "framer_create_code_file", componentInput("source.tsx"));
    const listed = await execute(h, "framer_list_code_files", {});
    expect(listed.details.discovery.files).toMatchObject([{ name: "Card.tsx", byteSize: 64 }]);
    expect(JSON.stringify(listed.details.discovery)).not.toContain("Needle value");
    const searched = await execute(h, "framer_search_code_files", { query: "Needle", maxMatches: 5, contextChars: 10 });
    expect(searched.details.discovery).toMatchObject({ filesScanned: 1, matches: [{ name: "Card.tsx" }] });
    expect(searched.details.discovery.matches[0].snippet.length).toBeLessThanOrEqual(26);
    await expect(execute(h, "framer_search_code_files", { query: " ../x", maxMatches: 5 })).rejects.toThrow("exact text");
  });

  it("creates source unchanged and records complete clean verification", async () => {
    const h = harness();
    const source = 'export default function Card(){const x = `outer ${`inner ${1}`}`; return <img alt="✓" />}';
    h.local.set("source.tsx", source);
    const result = await execute(h, "framer_create_code_file", componentInput("source.tsx"));
    expect(h.createCalls).toEqual([["Card.tsx", source]]);
    expect(result.details).toMatchObject({ status: "ok", mutationSucceeded: true, verificationComplete: true, verificationStatus: "complete", byteSize: Buffer.byteLength(source) });
    expect(result.content[0].text).not.toContain(source);
    expect(h.state.codeFiles.get("Card.tsx")).toMatchObject({ mutationVersion: 1, verificationVersion: 1, verificationStatus: "clean" });
  });

  it("returns an authoring route for a missing read and refuses overwrite", async () => {
    const h = harness();
    const missing = await execute(h, "framer_read_code_file", { name: "Missing.tsx" });
    expect(missing.details).toMatchObject({ status: "not_found" });
    h.local.set("source.tsx", "old");
    await execute(h, "framer_create_code_file", componentInput("source.tsx"));
    h.local.set("source.tsx", "new");
    await expect(execute(h, "framer_create_code_file", componentInput("source.tsx"))).rejects.toThrow("already exists");
    expect(h.remote.get("Card.tsx").content).toBe("old");
  });

  it("prevents stale remote writes and directs the agent to reapply", async () => {
    const h = harness();
    h.local.set("source.tsx", "first");
    const created = await execute(h, "framer_create_code_file", componentInput("source.tsx"));
    h.remote.get("Card.tsx").content = "external edit";
    h.local.set("source.tsx", "our edit");
    const conflict = await execute(h, "framer_update_code_file", { ...componentInput("source.tsx"), snapshotToken: created.details.snapshotToken });
    expect(conflict.details).toMatchObject({ status: "conflict", mutationSucceeded: false });
    expect(conflict.details.instruction).toMatch(/Re-read.*reapply/i);
    expect(h.remote.get("Card.tsx").content).toBe("external edit");
    expect(h.remote.get("Card.tsx").setCalls).toBeUndefined();
  });

  it("updates from a run-local token, refreshes it, and rejects reuse in another session", async () => {
    const first = harness();
    first.local.set("source.tsx", "first");
    const created = await execute(first, "framer_create_code_file", componentInput("source.tsx"));
    first.local.set("source.tsx", "second");
    const updated = await execute(first, "framer_update_code_file", { ...componentInput("source.tsx"), snapshotToken: created.details.snapshotToken });
    expect(first.remote.get("Card.tsx").content).toBe("second");
    expect(updated.details.snapshotToken).not.toBe(created.details.snapshotToken);

    const second = harness();
    second.local.set("source.tsx", "stolen");
    await expect(execute(second, "framer_update_code_file", { ...componentInput("source.tsx"), snapshotToken: created.details.snapshotToken })).rejects.toThrow("missing or expired");
  });

  it("records incomplete verification and export/diagnostic issues", async () => {
    const h = harness();
    h.local.set("source.tsx", "source");
    const created = await execute(h, "framer_create_code_file", componentInput("source.tsx"));
    const file = h.remote.get("Card.tsx");
    file.typecheckError = true;
    h.local.set("source.tsx", "changed");
    const incomplete = await execute(h, "framer_update_code_file", { ...componentInput("source.tsx"), snapshotToken: created.details.snapshotToken });
    expect(incomplete.details).toMatchObject({ mutationSucceeded: true, verificationComplete: false, verificationStatus: "incomplete" });
    expect(h.state.codeFiles.get("Card.tsx")).toMatchObject({ mutationVersion: 2, verificationVersion: 1, verificationStatus: "incomplete" });

    file.typecheckError = false;
    file.diagnostics = [{ message: "Type mismatch", line: 4 }];
    file.exports = [];
    const issues = await execute(h, "framer_check_code_file", { name: "Card.tsx", expectedExport: "component" });
    expect(issues.details).toMatchObject({ verificationStatus: "issues", diagnostics: [{ message: "Type mismatch", line: 4 }] });
    expect(issues.details.exportDiagnostic).toMatch(/default component export/);
  });

  it("validates filenames, byte limits, and evidence envelopes", async () => {
    const h = harness();
    h.local.set("large.tsx", "✓".repeat(MAX_CODE_FILE_SOURCE_BYTES / 2));
    await expect(execute(h, "framer_create_code_file", componentInput("large.tsx"))).rejects.toThrow("byte limit");
    await expect(execute(h, "framer_read_code_file", { name: "../Card.tsx" })).rejects.toThrow("single");
    expect(() => parseCodeFileEvidence({ kind: "ok", mutated: true, verificationComplete: true, exports: "bad", diagnostics: [] })).toThrow("diagnostics");
  });
});
