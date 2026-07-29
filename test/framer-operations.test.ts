import { describe, expect, it } from "vitest";
import { createFramerAgentCoreExtension, type FramerExecutionAdapter, type FramerRunState } from "../src/index.js";
import { captureExtensionTools, requireCapturedTool } from "../src/testing.js";

const PREFIX = "[LOTTUS_FRAMER_RESULT_V1]";
class Adapter implements FramerExecutionAdapter {
  source = ""; output: unknown = {};
  async docs() { return { visibleOutput: "docs" }; }
  async execute(source: string) { this.source = source; const rawOutput = `${PREFIX}${JSON.stringify(this.output)}`; return { rawOutput, visibleOutput: rawOutput }; }
}
function harness() {
  const adapter = new Adapter(); let state: FramerRunState | undefined;
  const tools = captureExtensionTools(createFramerAgentCoreExtension({ executionAdapter: adapter, onSessionStateCreated(value) { state = value; } }));
  return { adapter, tools, get state() { return state!; } };
}

describe("routine Framer operations", () => {
  it("resolves explicit Context Picker targets with bounded scope evidence", async () => {
    const h = harness(); h.adapter.output = { status: "found", nodeId: "node-1", actualScopeId: "page-1", node: { id: "node-1" } };
    const read = await requireCapturedTool(h.tools, "framer_read_node_context").execute("read", { nodeId: "node-1", expectedScopeId: "page-1", pagePath: "/" } as never) as any;
    expect(h.adapter.source).toContain("framer.agent.getNode");
    expect(h.adapter.source).toContain("framer.agent.serialize");
    expect(h.adapter.source).toContain("framer.agent.getScopeNode");
    expect(h.adapter.source).toContain("scope_mismatch");
    expect(read.details).toMatchObject({ operation: "read-node-context", explicitUserContext: true });
    expect(h.state.genericMutationVersion).toBe(0);
  });

  it("batches exact heterogeneous control reads", async () => {
    const h = harness(); h.adapter.output = [{ kind: "component", identifiers: ["c1"], value: { c1: {} } }, { kind: "icons", matches: ["Menu"] }];
    await requireCapturedTool(h.tools, "framer_read_controls").execute("x", { requests: [
      { kind: "component", componentIds: ["c1"] }, { kind: "icons", iconSetName: "Lucide", match: "menu", limit: 5 },
    ] } as never);
    expect(h.adapter.source).toContain("Promise.all");
    expect(h.adapter.source).toContain("readComponentControls");
    expect(h.adapter.source).toContain("readIcons");
    await expect(requireCapturedTool(h.tools, "framer_read_controls").execute("bad", { requests: [{ kind: "shader", shaderNames: [" bad"] }] } as never)).rejects.toThrow("exact");
  });

  it("validates read-only analytics and date bounds", async () => {
    const h = harness(); h.adapter.output = { rows: [{ views: 2 }], truncated: false };
    await requireCapturedTool(h.tools, "framer_query_analytics").execute("ok", { query: "SELECT count() AS views FROM events LIMIT 10", from: "2026-07-01", to: "2026-07-02" } as never);
    expect(h.adapter.source).toContain("queryAnalytics");
    expect(h.state.genericMutationVersion).toBe(0);
    await expect(requireCapturedTool(h.tools, "framer_query_analytics").execute("write", { query: "DELETE FROM events", from: "2026-07-01" } as never)).rejects.toThrow("read-only");
    await expect(requireCapturedTool(h.tools, "framer_query_analytics").execute("star", { query: "SELECT * FROM events", from: "2026-07-01" } as never)).rejects.toThrow("SELECT *");
  });

  it("self-verifies exact text replacement and leaves ambiguous readback pending", async () => {
    const h = harness(); h.adapter.output = {
      status: "success", replaced: true, verificationStatus: "verified",
      before: { status: "read", text: "Old", textRunCount: 1, truncated: false },
      after: { status: "read", text: "New", textRunCount: 1, truncated: false }, occurrences: 1,
    };
    const replaced = await requireCapturedTool(h.tools, "framer_replace_text").execute("replace", { id: "text-1", searchText: "Old", replaceText: "New" } as never) as any;
    expect(replaced.details).toMatchObject({ mutationVersion: 1, verificationStatus: "verified" });
    expect(h.adapter.source).toContain("framer.agent.getNode({ id }");
    expect(h.state).toMatchObject({ genericMutationVersion: 1, genericEvidenceVersion: 1 });
    expect(h.state.genericVerificationAction).toBeUndefined();

    h.adapter.output = { status: "success", replaced: true, verificationStatus: "pending", before: { status: "read", text: "Old Old" }, after: { status: "missing" }, occurrences: 2 };
    const ambiguous = await requireCapturedTool(h.tools, "framer_replace_text").execute("ambiguous", { id: "text-1", searchText: "Old", replaceText: "New" } as never) as any;
    expect(ambiguous.details).toMatchObject({ mutationVersion: 2, verificationStatus: "pending" });
    expect(h.state).toMatchObject({ genericMutationVersion: 2, genericEvidenceVersion: 1 });
    expect(h.state.typedVerificationAction).toContain("typed text readback");
    expect(h.state.typedVerification).toMatchObject({ kind: "replace-text", mutationVersion: 2, id: "text-1" });
    await expect(requireCapturedTool(h.tools, "framer_verify_mutation").execute("wrong-verifier", {
      mutationVersion: 2, assertion: "true", expected: "text changed",
    } as never)).rejects.toThrow("framer_verify_typed_operation");
    h.adapter.output = { status: "verified", readback: { status: "read", text: "New New", truncated: false } };
    await requireCapturedTool(h.tools, "framer_verify_typed_operation").execute("typed-verify", {
      mutationVersion: 2, expectedText: "New New",
    } as never);
    expect(h.state).toMatchObject({ genericMutationVersion: 2, genericEvidenceVersion: 2 });
    expect(h.state.typedVerification).toBeUndefined();
  });

  it("proves a unique partial replacement across rich-text runs without assuming multi-match semantics", async () => {
    const h = harness(); h.adapter.output = {
      status: "success", replaced: true, verificationStatus: "verified",
      before: { status: "read", text: "Ship Old copy", textRunCount: 3, truncated: false },
      after: { status: "read", text: "Ship New copy", textRunCount: 3, truncated: false }, occurrences: 1,
    };
    await requireCapturedTool(h.tools, "framer_replace_text").execute("replace", {
      id: "rich-text", searchText: "Old", replaceText: "New",
    } as never);
    expect(h.adapter.source).toContain("parts.join");
    expect(h.adapter.source).toContain("occurrences === 1");
    expect(h.state).toMatchObject({ genericMutationVersion: 1, genericEvidenceVersion: 1 });
  });

  it("records component mutation evidence only on structured success", async () => {
    const h = harness();
    h.adapter.output = { status: "blocked", message: "external" };
    await requireCapturedTool(h.tools, "framer_flatten_component").execute("flatten", { id: "instance-1" } as never);
    expect(h.state.genericMutationVersion).toBe(0);
    h.adapter.output = { status: "success", component: { id: "local" }, verificationStatus: "verified", readback: { id: "instance-2", type: "ComponentInstanceNode", component: "local" } };
    await requireCapturedTool(h.tools, "framer_make_component_local").execute("local", { id: "instance-2", replaceAll: false } as never);
    expect(h.state).toMatchObject({ genericMutationVersion: 1, genericEvidenceVersion: 1 });
  });

  it("retries replace-all localization with bounded typed project readback", async () => {
    const h = harness(); h.adapter.output = {
      status: "success", component: { id: "local" }, previousComponentId: "external",
      verificationStatus: "pending", readback: { id: "instance-2", type: "ComponentInstanceNode", component: "local" },
      remainingExternalInstances: { count: 1, sampleIds: ["instance-3"] },
    };
    await requireCapturedTool(h.tools, "framer_make_component_local").execute("local-all", {
      id: "instance-2", replaceAll: true,
    } as never);
    expect(h.state.typedVerification).toMatchObject({
      kind: "make-component-local", mutationVersion: 1, previousComponentId: "external", replaceAll: true,
    });
    h.adapter.output = { status: "verified", remainingExternalInstances: { count: 0, sampleIds: [] } };
    await requireCapturedTool(h.tools, "framer_verify_typed_operation").execute("verify-all", { mutationVersion: 1 } as never);
    expect(h.adapter.source).toContain("getNodesOfTypes");
    expect(h.adapter.source).toContain("remaining.length === 0");
    expect(h.state).toMatchObject({ genericMutationVersion: 1, genericEvidenceVersion: 1 });
  });

  it("prohibits dedicated families in generic execution", async () => {
    const exec = requireCapturedTool(harness().tools, "framer_exec");
    for (const source of ["await framer.agent.queryAnalytics({})", "await framer.agent.replaceText({})", "await framer.agent.readIcons({})"]) {
      await expect(exec.execute("x", { source, purpose: "x", effect: "read" } as never)).rejects.toThrow("typed Framer operation");
    }
  });
});
