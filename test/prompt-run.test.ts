import { describe, expect, it, vi } from "vitest";
import { createPromptRunBaseline, createPromptRunSteeringExtension, evaluateProfileEfficiency, requiresDesignPlan } from "../src/index.js";

describe("Prompt Run context and steering", () => {
  it("uses explicit Context Picker targets and never claims headless selection access", async () => {
    const handlers: Array<(event: any) => Promise<any>> = [];
    createPromptRunSteeringExtension()({ on(name: string, handler: any) { if (name === "before_agent_start") handlers.push(handler); }, registerTool() {} } as any);
    const result = await handlers[0]!({ prompt: "improve this", systemPrompt: "stable", systemPromptOptions: {} }, { cwd: "/tmp/project" });
    expect(result.systemPrompt).toContain("Context Picker JSON is explicit user-provided Framer context");
    expect(result.systemPrompt).toContain("framer_read_node_context");
    expect(result.systemPrompt).toContain("Never infer the user's local Framer selection");
    expect(result.systemPrompt).not.toContain("Live Framer Context");
  });

  it("requires plans for substantial work but not narrow copy or property edits", () => {
    expect(requiresDesignPlan("Create a responsive landing page")).toBe(true);
    expect(requiresDesignPlan("Change the button label to Join")).toBe(false);
    expect(requiresDesignPlan("Set card radius to 12")).toBe(false);
  });

  it("isolates optional work items and validates dependencies and evidence", async () => {
    const tools = new Map<string, any>();
    createPromptRunSteeringExtension({ profile: { dependencyWorkItems: true } })({ on() {}, registerTool(tool: any) { tools.set(tool.name, tool); } } as any);
    expect([...tools.keys()]).toEqual(["record_design_plan", "complete_framer_work_item"]);
    await tools.get("record_design_plan").execute("1", { strategy: "creation", scope: "Home", items: [{ id: "hero", title: "Hero", scope: "Home", visibleDecisions: ["centered"], reusableSystemDecisions: ["inline"], verificationTargets: ["screenshot"] }, { id: "nav", title: "Nav", scope: "Home", visibleDecisions: ["top"], reusableSystemDecisions: ["component"], verificationTargets: ["read"] }] });
    await expect(tools.get("complete_framer_work_item").execute("2", { id: "nav", dependencies: ["hero"], implementationEvidence: ["mutation"], verificationEvidence: ["read"] })).rejects.toThrow("Incomplete");
    await tools.get("complete_framer_work_item").execute("3", { id: "hero", dependencies: [], implementationEvidence: ["mutation"], verificationEvidence: ["screenshot"] });
    await tools.get("complete_framer_work_item").execute("4", { id: "nav", dependencies: ["hero"], implementationEvidence: ["mutation"], verificationEvidence: ["read"] });
  });

  it("rejects efficient trajectories that regress safety", () => {
    const make = (steps: number, functional: "passed" | "failed") => createPromptRunBaseline({ trajectory: "canvas", model: "m", harnessProfile: "p", measurements: { modelSteps: steps }, outcome: { functional, visualReview: "passed", unintendedSideEffects: [] } });
    expect(evaluateProfileEfficiency(make(8, "passed"), make(4, "failed"))).toMatchObject({ accepted: false });
    expect(evaluateProfileEfficiency(make(8, "passed"), make(4, "passed"))).toMatchObject({ accepted: true, stepReduction: 4 });
  });
});
