import { describe, expect, it } from "vitest";
import {
  createFramerAgentCoreExtension,
  type FramerExecutionAdapter,
  type FramerRunState,
} from "../src/index.js";
import { captureExtensionTools, requireCapturedTool } from "../src/testing.js";

const RESULT_PREFIX = "[LOTTUS_FRAMER_RESULT_V1]";

class FakeExecutionAdapter implements FramerExecutionAdapter {
  readonly docsCalls: string[] = [];
  readonly executions: Array<{ source: string; timeoutMs: number }> = [];
  nextOutput = "read result";

  async docs(symbol: string) {
    this.docsCalls.push(symbol);
    return { visibleOutput: `docs for ${symbol}` };
  }

  async execute(source: string, options: { timeoutMs: number }) {
    this.executions.push({ source, timeoutMs: options.timeoutMs });
    return { rawOutput: this.nextOutput, visibleOutput: this.nextOutput };
  }
}

function harness(adapter = new FakeExecutionAdapter()) {
  let state: FramerRunState | undefined;
  const tools = captureExtensionTools(createFramerAgentCoreExtension({
    executionAdapter: adapter,
    onSessionStateCreated(value) {
      state = value;
    },
  }));
  return { adapter, tools, get state() { return state!; } };
}

describe("Framer canvas Core conformance", () => {
  it("registers docs, general execution, and focused canvas tools", () => {
    const { tools } = harness();
    expect([...tools.keys()].sort()).toEqual([
      "ask_user",
      "finish_framer_work",
      "framer_apply_changes",
      "framer_docs",
      "framer_exec",
    ]);
  });

  it("validates exact documentation symbols and delegates valid lookup", async () => {
    const { tools, adapter } = harness();
    const docs = requireCapturedTool(tools, "framer_docs");
    await expect(docs.execute("bad", { query: "how do I create a page" } as never)).rejects.toThrow("exact symbol");
    await expect(docs.execute("ok", { query: " CodeFile.typecheck " } as never)).resolves.toMatchObject({
      content: [{ text: "docs for CodeFile.typecheck" }],
    });
    expect(adapter.docsCalls).toEqual(["CodeFile.typecheck"]);
  });

  it("blocks raw code-file lifecycle and canvas apply calls", async () => {
    const exec = requireCapturedTool(harness().tools, "framer_exec");
    const input = (source: string) => ({ source, purpose: "test", effect: "mutate" }) as never;
    await expect(exec.execute("code", input("await framer . getCodeFile('Card.tsx')"))).rejects.toThrow("framer_read_code_file");
    await expect(exec.execute("remove", input("await CodeFile.remove()"))).rejects.toThrow("code-file lifecycle");
    await expect(exec.execute("canvas", input("await framer.agent.applyChanges('x')"))).rejects.toThrow("framer_apply_changes");
  });

  it("delegates reads with cancellation and canonical timeouts", async () => {
    const { tools, adapter } = harness();
    const signal = new AbortController().signal;
    const result = await requireCapturedTool(tools, "framer_exec").execute(
      "read",
      { source: "console.log(await framer.getNodesWithAttribute('x'))", purpose: "Inspect", effect: "read" } as never,
      signal,
    );
    expect(result).toMatchObject({ content: [{ text: "read result" }], details: { effect: "read" } });
    expect(adapter.executions[0]?.timeoutMs).toBe(120_000);
  });

  it("records complete clean mutation evidence", async () => {
    const h = harness();
    h.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "success", affectedCount: 1 })}`;
    const result = await requireCapturedTool(h.tools, "framer_apply_changes").execute(
      "apply-clean",
      { dsl: "Create WebPage /home", pagePath: "/home" } as never,
    ) as { details: { evidence: { status: string } } };
    expect(result.details.evidence.status).toBe("clean");
    expect(h.state).toMatchObject({ canvasMutationVersion: 1, canvasEvidenceVersion: 1, canvasEvidenceStatus: "clean" });
    expect(h.adapter.executions[0]?.source).toContain('pagePath: "/home"');
  });

  it("normalizes bounded deterministic mutation evidence", async () => {
    const h = harness();
    h.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({
      status: "success",
      warnings: Array.from({ length: 60 }, (_, index) => ({ message: `Warning ${String(59 - index).padStart(2, "0")}`, nodeId: `node-${index}` })),
      affectedIds: ["z", "a", "a"],
      renamedIds: { z: "new-z", a: "new-a" },
    })}`;
    const result = await requireCapturedTool(h.tools, "framer_apply_changes").execute(
      "apply",
      { dsl: "Create WebPage /home" } as never,
    ) as { details: { evidence: { status: string; diagnostics: unknown[]; affected: { ids: string[] }; renamedIds: object } } };
    expect(result.details.evidence.status).toBe("issues");
    expect(result.details.evidence.diagnostics).toHaveLength(50);
    expect(result.details.evidence.affected.ids).toEqual(["a", "z"]);
    expect(Object.keys(result.details.evidence.renamedIds)).toEqual(["a", "z"]);
    expect(h.state).toMatchObject({ canvasMutationVersion: 1, canvasEvidenceVersion: 1, canvasEvidenceStatus: "issues" });
  });

  it("fails incomplete for malformed and unknown mutation output", async () => {
    for (const output of [`${RESULT_PREFIX}{bad json`, "ordinary output"]) {
      const h = harness();
      h.adapter.nextOutput = output;
      await expect(requireCapturedTool(h.tools, "framer_apply_changes").execute("apply", { dsl: "x" } as never)).rejects.toThrow(/structured evidence|malformed/i);
      expect(h.state.canvasEvidenceStatus).toBe("incomplete");
      expect(h.state.canvasEvidenceVersion).toBeLessThan(h.state.canvasMutationVersion);
    }

    for (const value of [
      { unexpected: true },
      { results: "not an array" },
      { status: "mystery", affectedIds: [] },
    ]) {
      const unknown = harness();
      unknown.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify(value)}`;
      const result = await requireCapturedTool(unknown.tools, "framer_apply_changes").execute("unknown", { dsl: "x" } as never) as {
        details: { evidence: { status: string } };
      };
      expect(result.details.evidence.status).toBe("incomplete");
      expect(unknown.state.canvasEvidenceStatus).toBe("incomplete");
    }
  });

  it("isolates canvas and publication state per Pi session", async () => {
    const adapter = new FakeExecutionAdapter();
    let firstState: FramerRunState | undefined;
    let secondState: FramerRunState | undefined;
    const extension = createFramerAgentCoreExtension({
      executionAdapter: adapter,
      onSessionStateCreated(state) {
        if (!firstState) firstState = state;
        else secondState = state;
      },
    });
    const first = captureExtensionTools(extension);
    const second = captureExtensionTools(extension);
    await requireCapturedTool(first, "framer_exec").execute("publish", {
      source: "await framer.publish()", purpose: "Publish", effect: "other",
    } as never);
    expect(firstState?.published).toBe(true);
    expect(secondState?.published).toBe(false);
    expect(firstState).not.toBe(secondState);
  });
});
