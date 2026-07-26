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

  it("records typed mutation evidence only on structured success", async () => {
    const h = harness(); h.adapter.output = { status: "success", replaced: true };
    const replaced = await requireCapturedTool(h.tools, "framer_replace_text").execute("replace", { id: "text-1", searchText: "Old", replaceText: "New" } as never) as any;
    expect(replaced.details.mutationVersion).toBe(1);
    expect(h.state.genericVerificationAction).toContain("text replacement");
    h.adapter.output = { status: "blocked", message: "external" };
    await requireCapturedTool(h.tools, "framer_flatten_component").execute("flatten", { id: "instance-1" } as never);
    expect(h.state.genericMutationVersion).toBe(1);
    h.adapter.output = { status: "success", component: { id: "local" } };
    await requireCapturedTool(h.tools, "framer_make_component_local").execute("local", { id: "instance-2", replaceAll: false } as never);
    expect(h.state.genericMutationVersion).toBe(2);
  });

  it("prohibits dedicated families in generic execution", async () => {
    const exec = requireCapturedTool(harness().tools, "framer_exec");
    for (const source of ["await framer.agent.queryAnalytics({})", "await framer.agent.replaceText({})", "await framer.agent.readIcons({})"]) {
      await expect(exec.execute("x", { source, purpose: "x", effect: "read" } as never)).rejects.toThrow("typed Framer operation");
    }
  });
});
