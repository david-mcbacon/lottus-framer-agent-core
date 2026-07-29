import { describe, expect, it } from "vitest";
import {
  createFramerCompletionExtension,
  createFramerAgentCoreExtension,
  type FramerExecutionAdapter,
  type FramerRunState,
} from "../src/index.js";
import { captureExtensionTools, requireCapturedTool } from "../src/testing.js";

const adapter: FramerExecutionAdapter = {
  async docs() {
    return { visibleOutput: "docs" };
  },
  async execute() {
    return { rawOutput: "output", visibleOutput: "output" };
  },
};

function harness() {
  let state: FramerRunState | undefined;
  const tools = captureExtensionTools(createFramerAgentCoreExtension({
    executionAdapter: adapter,
    onSessionStateCreated(value) {
      state = value;
    },
  }));
  return { tools, get state() { return state!; } };
}

const cleanInput = {
  summary: "  Updated the landing page  ",
  visibleChanges: ["  Refined the hero  "],
  unresolvedIssues: [],
} as never;

describe("Framer structured completion", () => {
  it("is part of the aggregate Core extension and terminates with stable details", async () => {
    const h = harness();
    const finish = requireCapturedTool(h.tools, "finish_framer_work");

    const result = await finish.execute("finish", cleanInput) as {
      terminate: boolean;
      details: Record<string, unknown>;
    };

    expect(result).toMatchObject({
      terminate: true,
      details: {
        type: "lottus_framer_completion",
        summary: "Updated the landing page",
        visibleChanges: ["Refined the hero"],
        reviewStatus: "not_needed",
        unresolvedIssues: [],
        published: false,
      },
    });
  });

  it("blocks incomplete latest canvas and code-file mutations", async () => {
    const canvas = harness();
    canvas.state.canvasMutationVersion = 1;
    await expect(requireCapturedTool(canvas.tools, "finish_framer_work").execute("canvas", cleanInput))
      .rejects.toThrow("complete diagnostics");

    const code = harness();
    code.state.codeFiles.set("Card.tsx", {
      mutationVersion: 1,
      verificationVersion: 0,
      verificationStatus: "incomplete",
      diagnostics: [],
    });
    await expect(requireCapturedTool(code.tools, "finish_framer_work").execute("code", cleanInput))
      .rejects.toThrow("Card.tsx");
  });

  it("reports pending evidence before validating unresolved issue claims", async () => {
    const h = harness();
    h.state.genericMutationVersion = 1;
    h.state.genericVerificationAction = "verify the latest text replacement";
    await expect(requireCapturedTool(h.tools, "finish_framer_work").execute("pending", {
      summary: "Done",
      visibleChanges: [],
      unresolvedIssues: ["Verifier unavailable"],
    } as never)).rejects.toThrow("verify the latest text replacement");
  });

  it("labels model stop after failed finish as incomplete", async () => {
    const state = harness().state;
    state.genericMutationVersion = 1;
    state.genericVerificationAction = "verify the latest text replacement";
    const handlers = new Map<string, Array<() => void>>();
    const messages: Array<Record<string, unknown>> = [];
    createFramerCompletionExtension(state)({
      on(name: string, handler: () => void) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); },
      sendMessage(message: Record<string, unknown>) { messages.push(message); },
      registerTool() {},
    } as never);
    handlers.get("agent_start")?.forEach((handler) => handler());
    handlers.get("agent_end")?.forEach((handler) => handler());
    expect(messages).toEqual([expect.objectContaining({
      customType: "lottus_runtime_status",
      content: expect.stringContaining("Framer work incomplete"),
      display: true,
    })]);
  });

  it("requires unresolved issues exactly when latest evidence reports issues", async () => {
    const h = harness();
    h.state.canvasMutationVersion = 1;
    h.state.canvasEvidenceVersion = 1;
    h.state.canvasEvidenceStatus = "issues";
    h.state.canvasDiagnostics = [{ severity: "error", message: "Broken link" }];
    const finish = requireCapturedTool(h.tools, "finish_framer_work");

    await expect(finish.execute("missing", cleanInput)).rejects.toThrow("must list");
    await expect(finish.execute("listed", {
      summary: "Done",
      visibleChanges: [],
      unresolvedIssues: ["  Broken link  "],
    } as never)).resolves.toMatchObject({
      terminate: true,
      details: { reviewStatus: "issues_remain", unresolvedIssues: ["Broken link"] },
    });

    h.state.canvasEvidenceStatus = "clean";
    h.state.canvasDiagnostics = [];
    h.state.geometryEvidenceVersion = 1;
    await expect(finish.execute("false-issue", {
      summary: "Done",
      visibleChanges: [],
      unresolvedIssues: ["Not evidenced"],
    } as never)).rejects.toThrow("evidence is clean");
  });

  it("isolates concurrent extension assemblies and a resumed Pi session", async () => {
    const states: FramerRunState[] = [];
    const options = {
      executionAdapter: adapter,
      onSessionStateCreated(state: FramerRunState) {
        states.push(state);
      },
    };
    const extension = createFramerAgentCoreExtension(options);
    const first = captureExtensionTools(extension);
    const concurrent = captureExtensionTools(extension);
    const resumed = captureExtensionTools(createFramerAgentCoreExtension(options));
    states[0]!.canvasMutationVersion = 1;

    const results = await Promise.allSettled([
      requireCapturedTool(first, "finish_framer_work").execute("first", cleanInput),
      requireCapturedTool(concurrent, "finish_framer_work").execute("concurrent", cleanInput),
      requireCapturedTool(resumed, "finish_framer_work").execute("resumed", cleanInput),
    ]);

    expect(results[0]).toMatchObject({ status: "rejected", reason: expect.objectContaining({ message: expect.stringContaining("Completion blocked") }) });
    expect(results[1]).toMatchObject({ status: "fulfilled", value: { details: { reviewStatus: "not_needed" } } });
    expect(results[2]).toMatchObject({ status: "fulfilled", value: { details: { reviewStatus: "not_needed" } } });
    expect(new Set(states).size).toBe(3);
  });
});
