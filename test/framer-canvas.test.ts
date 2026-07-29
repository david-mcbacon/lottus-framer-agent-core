import { describe, expect, it } from "vitest";
import {
  createFramerAgentCoreExtension,
  observeFramerSourceEffect,
  type FramerExecutionAdapter,
  type FramerObservedEffect,
  type FramerRunState,
} from "../src/index.js";
import { captureExtensionTools, requireCapturedTool } from "../src/testing.js";

const RESULT_PREFIX = "[LOTTUS_FRAMER_RESULT_V1]";

class FakeExecutionAdapter implements FramerExecutionAdapter {
  readonly docsCalls: string[] = [];
  readonly executions: Array<{ source: string; timeoutMs: number }> = [];
  nextOutput = "read result";
  nextObservedEffect: FramerObservedEffect | undefined;
  nextError: Error | undefined;

  async docs(symbol: string) {
    this.docsCalls.push(symbol);
    return { visibleOutput: `docs for ${symbol}` };
  }

  async execute(source: string, options: { timeoutMs: number }) {
    this.executions.push({ source, timeoutMs: options.timeoutMs });
    if (this.nextError) throw this.nextError;
    return { rawOutput: this.nextOutput, visibleOutput: this.nextOutput, ...(this.nextObservedEffect ? { observedEffect: this.nextObservedEffect } : {}) };
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
      "framer_flatten_component",
      "framer_get_guides",
      "framer_make_component_local",
      "framer_publish",
      "framer_query_analytics",
      "framer_read_controls",
      "framer_read_node_context",
      "framer_replace_text",
      "framer_search_fonts",
      "framer_verify_mutation",
      "framer_verify_typed_operation",
      "record_design_plan",
    ]);
  });

  it("retrieves multiple exact guides through one public project query", async () => {
    const { tools, adapter } = harness();
    adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ queryResults: [{ name: "Buttons" }, { name: "Forms" }] })}`;
    const result = await requireCapturedTool(tools, "framer_get_guides").execute(
      "guides",
      { names: ["Buttons", "Forms"], pagePath: "/" } as never,
    ) as { content: Array<{ text: string }> };
    expect(adapter.executions).toHaveLength(1);
    expect(adapter.executions[0]?.source).toContain('"implementation-guide-from-index","name":"Buttons"');
    expect(JSON.parse(result.content[0]!.text)).toMatchObject({ source: "framer.agent.readProject", kind: "implementation-guides" });
    await expect(requireCapturedTool(tools, "framer_get_guides").execute(
      "unknown", { names: ["Imaginary Guide"] } as never,
    )).rejects.toThrow("Unknown Framer implementation guide: Imaginary Guide");
  });

  it("delegates bounded font descriptors without reranking", async () => {
    const { tools, adapter } = harness();
    adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ queryResults: [{ fonts: ["Second", "First"] }] })}`;
    const result = await requireCapturedTool(tools, "framer_search_fonts").execute("fonts", {
      search: { query: "modern page typography", limit: 5, mustHave: ["serif"], mustHaveAlternativeCharacters: ["t"] },
    } as never) as { content: Array<{ text: string }> };
    expect(adapter.executions[0]?.source).toContain('"mustHaveAlternativeCharacters":["t"]');
    expect(JSON.parse(result.content[0]!.text)).toMatchObject({ matcher: "framer-server", result: { queryResults: [{ fonts: ["Second", "First"] }] } });
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
    expect(result).toMatchObject({ content: [{ text: "read result" }], details: { declaredEffect: "read" } });
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

  it("blocks generic publication and conservatively records generic mutations", async () => {
    const h = harness();
    const exec = requireCapturedTool(h.tools, "framer_exec");
    await expect(exec.execute("publish", { source: "await framer.agent.publish({action: 'preview'})", purpose: "Publish", effect: "read" } as never)).rejects.toThrow("framer_publish");
    await expect(exec.execute("mislabeled", { source: "await framer.agent.replaceText({})", purpose: "Replace", effect: "read" } as never)).rejects.toThrow("typed Framer operation");
    expect(h.state.genericMutationVersion).toBe(0);
  });

  it("uses adapter observation over model intent and handles advanced operations conservatively", async () => {
    const observed = harness();
    observed.adapter.nextObservedEffect = { kind: "mutation", succeeded: false, verificationAction: "inspect external mutation failure" };
    await requireCapturedTool(observed.tools, "framer_exec").execute("observed", { source: "console.log('claimed read')", purpose: "Read", effect: "read" } as never);
    expect(observed.state.genericVerificationAction).toBe("inspect external mutation failure");
    const verify = requireCapturedTool(observed.tools, "framer_verify_mutation");
    await expect(verify.execute("prose", { mutationVersion: 1, assertion: "the hero changed", expected: "changed" } as never)).rejects.toThrow("looks like prose");
    await expect(verify.execute("string", { mutationVersion: 1, assertion: "'the hero changed'", expected: "changed" } as never)).rejects.toThrow("string literal");
    observed.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "verified" })}`;
    await expect(verify.execute("failed", { mutationVersion: 1, assertion: "(await framer.agent.getNode({ id: 'hero' })) !== null", expected: "changed" } as never)).rejects.toThrow("did not observe");
    observed.adapter.nextObservedEffect = { kind: "read", succeeded: true };
    observed.adapter.nextOutput = "logged state";
    await expect(verify.execute("log-only", { mutationVersion: 1, assertion: "(await framer.agent.getNode({ id: 'hero' })) !== null", expected: "changed" } as never)).rejects.toThrow("structured evidence");
    observed.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "verified" })}`;
    await verify.execute("verified", { mutationVersion: 1, assertion: "(await framer.agent.getNode({ id: 'hero' })) !== null", expected: "changed" } as never);
    expect(observed.state.genericEvidenceVersion).toBe(1);
    expect(observed.adapter.executions.at(-1)?.source).toContain('typeof verified !== "boolean"');

    const invalidArguments = harness();
    invalidArguments.state.genericMutationVersion = 1;
    invalidArguments.adapter.nextError = new Error("Error on typia.createAssert(): invalid type on $input[0]");
    await expect(requireCapturedTool(invalidArguments.tools, "framer_verify_mutation").execute("invalid-api", {
      mutationVersion: 1, assertion: "(await framer.agent.getNode('hero')) !== null", expected: "changed",
    } as never)).rejects.toThrow("getNode({ id: 'node-id' })");

    const unknown = harness();
    await requireCapturedTool(unknown.tools, "framer_exec").execute("unknown", { source: "await framer.agent.experimental()", purpose: "Advanced", effect: "other" } as never);
    expect(unknown.state.genericMutationVersion).toBe(1);
  });

  it("classifies executed source conservatively without model intent", () => {
    expect(observeFramerSourceEffect("await framer.agent.getNode({ id: 'hero' })", true)).toEqual({ kind: "read", succeeded: true });
    expect(observeFramerSourceEffect("await framer.agent.replaceText({})", true)).toEqual({ kind: "mutation", succeeded: true });
    expect(observeFramerSourceEffect("await framer.agent.publish({ action: 'preview' })", true)).toEqual({ kind: "publication", succeeded: true });
    expect(observeFramerSourceEffect("await framer.agent.experimental()", true)).toEqual({ kind: "unknown", succeeded: true });
  });

  it("previews without publishing, rejects stale confirmation, and records structured targets", async () => {
    const h = harness();
    const publish = requireCapturedTool(h.tools, "framer_publish");
    h.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "ready", confirmationHash: "current", changes: ["page"] })}`;
    await publish.execute("preview", { action: "preview" } as never);
    expect(h.state.published).toBe(false);
    await expect(publish.execute("stale", { action: "confirm_publish", confirmationHash: "old" } as never)).rejects.toThrow("stale");
    h.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "published", success: true, target: "staging" })}`;
    await publish.execute("confirm", { action: "confirm_publish", confirmationHash: "current" } as never);
    expect(h.state).toMatchObject({ published: true, publicationTarget: "staging" });
    h.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "deployed", success: true })}`;
    await publish.execute("production", { action: "deploy_to_production", version: "version-1" } as never);
    expect(h.state.publicationTarget).toBe("production");
  });

  it("does not publish on blocking diagnostics or failed confirmation", async () => {
    const h = harness();
    const publish = requireCapturedTool(h.tools, "framer_publish");
    h.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "blocked", confirmationHash: "bad", errors: [{ message: "broken" }] })}`;
    await publish.execute("blocked", { action: "preview" } as never);
    expect(h.state.published).toBe(false);
    expect(h.state.publicationPreviewHash).toBeUndefined();

    h.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "ready", confirmationHash: "valid" })}`;
    await publish.execute("ready", { action: "preview" } as never);
    h.adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "failed", success: false })}`;
    await publish.execute("failed", { action: "confirm_publish", confirmationHash: "valid" } as never);
    expect(h.state.published).toBe(false);
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
    const publication = requireCapturedTool(first, "framer_publish");
    adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "ready", confirmationHash: "hash" })}`;
    await publication.execute("preview", { action: "preview" } as never);
    adapter.nextOutput = `${RESULT_PREFIX}${JSON.stringify({ status: "published", success: true, target: "branch" })}`;
    await publication.execute("confirm", { action: "confirm_publish", confirmationHash: "hash" } as never);
    expect(firstState?.published).toBe(true);
    expect(secondState?.published).toBe(false);
    expect(firstState).not.toBe(secondState);
  });
});
