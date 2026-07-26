import { describe, expect, it } from "vitest";
import { createFramerAgentCoreExtension, type FramerRunState, type FramerVisualAdapter } from "../src/index.js";
import { captureExtensionTools, requireCapturedTool } from "../src/testing.js";

const pixel = new Uint8Array([137, 80, 78, 71]);
const adapter: FramerVisualAdapter = {
  async captureProject() { return { data: pixel, mimeType: "image/png" }; },
  async viewExternal() { return { data: pixel, mimeType: "image/png" }; },
  async inspectGeometry() { return { complete: true, diagnostics: [{ kind: "overlap", location: "hero/card", action: "increase gap" }] }; },
  async searchStock() { return [{ url: "https://framerusercontent.com/asset.jpg", title: "Asset" }]; },
};

function harness() {
  let state: FramerRunState | undefined;
  const tools = captureExtensionTools(createFramerAgentCoreExtension({
    executionAdapter: { async docs() { return { visibleOutput: "docs" }; }, async execute() { return { rawOutput: '[LOTTUS_FRAMER_RESULT_V1]{"status":"success"}', visibleOutput: "ok" }; } },
    visualAdapter: adapter,
    onSessionStateCreated(value) { state = value; },
  }));
  return { tools, get state() { return state!; } };
}

describe("tiered visual verification", () => {
  it("returns image content without textual bytes and keeps external views non-evidentiary", async () => {
    const h = harness();
    await requireCapturedTool(h.tools, "framer_apply_changes").execute("apply", { dsl: "x", visualRisk: "recreation" } as never);
    const viewed = await requireCapturedTool(h.tools, "framer_view_image").execute("view", { url: "https://example.com/reference.png", maxWidth: 800, maxHeight: 600 } as never) as { content: Array<{ type: string; data: string }>; details: { projectEvidence: boolean } };
    expect(viewed).toMatchObject({ content: [{ type: "image" }], details: { projectEvidence: false } });
    expect(h.state.screenshotEvidenceVersion).toBe(0);
    await expect(requireCapturedTool(h.tools, "finish_framer_work").execute("finish", { summary: "done", visibleChanges: [], unresolvedIssues: [] } as never)).rejects.toThrow("screenshot");
    const captured = await requireCapturedTool(h.tools, "framer_capture_screenshot").execute("capture", { target: "/", maxWidth: 1440, maxHeight: 1200 } as never) as { content: Array<{ type: string; data: string }> };
    expect(captured.content[0]).toMatchObject({ type: "image", data: Buffer.from(pixel).toString("base64") });
    await expect(requireCapturedTool(h.tools, "finish_framer_work").execute("finish", { summary: "done", visibleChanges: [], unresolvedIssues: [] } as never)).resolves.toBeDefined();
  });

  it("records compact bounded geometry and invalidates it on a later mutation", async () => {
    const h = harness();
    const result = await requireCapturedTool(h.tools, "framer_check_geometry").execute("geometry", { target: "hero", maxNodes: 100 } as never) as { content: Array<{ text: string }> };
    expect(JSON.parse(result.content[0]!.text).diagnostics[0]).toEqual({ kind: "overlap", location: "hero/card", action: "increase gap" });
    await requireCapturedTool(h.tools, "framer_apply_changes").execute("apply", { dsl: "x", visualRisk: "routine" } as never);
    expect(h.state.geometryEvidenceVersion).toBe(1);
    await requireCapturedTool(h.tools, "framer_apply_changes").execute("apply2", { dsl: "y", visualRisk: "recreation" } as never);
    expect(h.state.screenshotEvidenceVersion).toBeLessThan(h.state.canvasMutationVersion);
  });

  it("preserves exact trusted stock URLs", async () => {
    const h = harness();
    const result = await requireCapturedTool(h.tools, "framer_search_stock_images").execute("stock", { query: "mountains", limit: 5 } as never) as { details: { candidates: Array<{ url: string }> } };
    expect(result.details.candidates[0]!.url).toBe("https://framerusercontent.com/asset.jpg");
  });

  it("does not advance evidence on capture failure and isolates sessions", async () => {
    const failing: FramerVisualAdapter = { ...adapter, async captureProject() { throw new Error("capture failed"); } };
    const states: FramerRunState[] = [];
    const extension = createFramerAgentCoreExtension({
      executionAdapter: { async docs() { return { visibleOutput: "docs" }; }, async execute() { return { rawOutput: '[LOTTUS_FRAMER_RESULT_V1]{"status":"success"}', visibleOutput: "ok" }; } },
      visualAdapter: failing,
      onSessionStateCreated(state) { states.push(state); },
    });
    const first = captureExtensionTools(extension);
    captureExtensionTools(extension);
    states[0]!.canvasMutationVersion = 1;
    await expect(requireCapturedTool(first, "framer_capture_screenshot").execute("capture", { target: "/", maxWidth: 800, maxHeight: 600 } as never)).rejects.toThrow("capture failed");
    expect(states[0]!.screenshotEvidenceVersion).toBe(0);
    expect(states[1]!.canvasMutationVersion).toBe(0);
  });
});
