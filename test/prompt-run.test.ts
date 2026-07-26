import { describe, expect, it, vi } from "vitest";
import { createPromptRunBaseline, createPromptRunSteeringExtension, evaluateProfileEfficiency, renderLiveFramerContext, requiresDesignPlan } from "../src/index.js";

describe("Prompt Run context and steering", () => {
  it("refreshes selection each run and appends it after the stable prefix", async () => {
    let selection = "old"; const handlers: Array<(event: any) => Promise<any>> = [];
    createPromptRunSteeringExtension({ liveContextProvider: { async getLiveContext() { return { observedAt: new Date().toISOString(), availability: "available", selection: [{ name: selection }] }; } } })({ on(name: string, handler: any) { if (name === "before_agent_start") handlers.push(handler); }, registerTool() {} } as any);
    const first = await handlers[0]!({ prompt: "improve this", systemPrompt: "stable", systemPromptOptions: {} }, { cwd: "/tmp/project" });
    selection = "new"; const second = await handlers[0]!({ prompt: "improve this", systemPrompt: "stable", systemPromptOptions: {} }, { cwd: "/tmp/project" });
    expect(first.systemPrompt).toContain("old"); expect(second.systemPrompt).toContain("new");
    expect(second.systemPrompt.indexOf("stable")).toBeLessThan(second.systemPrompt.indexOf("Live Framer Context"));
  });

  it("represents unavailable canvas context and rejects lifecycle state", () => {
    expect(renderLiveFramerContext({ observedAt: "2026-07-27T00:00:00Z", availability: "unavailable", unavailableReason: "Desktop cannot observe canvas selection" })).toContain("unavailable");
    expect(() => renderLiveFramerContext({ observedAt: "2026-07-27T00:00:00Z", availability: "available", ...({ sessionId: "secret" } as any) })).toThrow("forbidden");
  });

  it("requires plans for substantial work but not narrow copy or property edits", () => {
    expect(requiresDesignPlan("Create a responsive landing page")).toBe(true);
    expect(requiresDesignPlan("Change the button label to Join")).toBe(false);
    expect(requiresDesignPlan("Set card radius to 12")).toBe(false);
  });

  it("isolates optional work items and validates dependencies and evidence", async () => {
    const tools = new Map<string, any>();
    createPromptRunSteeringExtension({ liveContextProvider: { async getLiveContext() { return { observedAt: new Date().toISOString(), availability: "unavailable", unavailableReason: "none" }; } }, profile: { dependencyWorkItems: true } })({ on() {}, registerTool(tool: any) { tools.set(tool.name, tool); } } as any);
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
