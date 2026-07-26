import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_FRAMER_PUBLIC_METHODS,
  SUPPORTED_FRAMER_AGENT_VERSIONS,
  compileFramerGuidance,
  createFramerAgentCoreExtension,
  inspectFramerCompatibility,
  type GuidanceSourceFile,
} from "../src/index.js";
import { captureExtensionTools } from "../src/testing.js";

function walk(directory: string, prefix = ""): GuidanceSourceFile[] {
  return readdirSync(directory).sort().flatMap((entry) => {
    const absolute = path.join(directory, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    return statSync(absolute).isDirectory()
      ? walk(absolute, relative)
      : [{ path: relative, content: readFileSync(absolute, "utf8") }];
  });
}

function capturedBundle(version: string): GuidanceSourceFile[] {
  const root = path.join(import.meta.dirname, "fixtures", `framer-agent-${version}`);
  const fixture = walk(root);
  const promptFiles = fixture.filter((file) => file.path.startsWith("prompt/"));
  const prompt = promptFiles.map((file) => file.content).join("\n\n");
  const inventory = "# Framer Project Inventory\n\n## Inventory\n\n<site-map>\n- Home (/): page-home\n</site-map>\n";
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  return [
    ...promptFiles.map((file) => ({ ...file, path: `framer/projects/capture/${file.path}` })),
    { path: "framer/projects/capture/project-inventory.md", content: inventory },
    { path: "framer/projects/capture/recipes.md", content: fixture.find((file) => file.path === "recipes.md")!.content },
    { path: "framer/projects/capture/metadata.json", content: JSON.stringify({ contextSchemaVersion: 1, promptHash: hash(prompt), contextHash: hash(inventory) }) },
  ];
}

describe("public upstream compatibility seam", () => {
  for (const version of SUPPORTED_FRAMER_AGENT_VERSIONS) {
    it(`compiles the complete real @framer/agent ${version} prompt capture`, () => {
      const files = capturedBundle(version);
      expect(files.filter((file) => file.path.includes("/prompt/")).length).toBe(11);
      expect(files.reduce((bytes, file) => bytes + Buffer.byteLength(file.content), 0)).toBeGreaterThan(240_000);
      const result = compileFramerGuidance({
        framerAgentVersion: version,
        projectId: "capture",
        sessionId: "1",
        upstreamBundle: { files },
      });
      expect(result.manifest).toMatchObject({ sourceAdapter: "v38-project-bundle", fallback: false, framerAgentVersion: version });
      expect(result.manifest.upstream.files).toHaveLength(files.length);
    });
  }

  it("records package, API, schema, prompt sections, and every required method", () => {
    const publicApi = { agent: { applyChanges() {} }, createCodeFile() {}, getCodeFile() {} };
    const record = inspectFramerCompatibility({
      packageVersion: "0.0.38",
      framerApiVersion: "2026.07",
      contextSchemaVersion: 1,
      promptSections: ["Tools", "Updating the Project", "Core Principles", "How Projects Work"],
      publicApi,
    });
    expect(Object.keys(record.publicMethods)).toEqual(REQUIRED_FRAMER_PUBLIC_METHODS);
    expect(record).toMatchObject({ packageVersion: "0.0.38", framerApiVersion: "2026.07", contextSchemaVersion: 1, compatible: true });
    expect(inspectFramerCompatibility({ ...record, promptSections: [], publicApi }).compatible).toBe(false);
  });

  it("omits optional steering without changing mandatory safety and result tools", () => {
    const adapter = { execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }) };
    const full = captureExtensionTools(createFramerAgentCoreExtension({ executionAdapter: adapter }));
    const reduced = captureExtensionTools(createFramerAgentCoreExtension({
      executionAdapter: adapter,
      capabilityProfile: { structuredDesignQuestions: false },
    }));
    expect(full.has("ask_user")).toBe(true);
    expect(reduced.has("ask_user")).toBe(false);
    expect([...reduced.keys()]).toEqual([...full.keys()].filter((name) => name !== "ask_user"));
    expect(reduced.has("framer_apply_changes")).toBe(true);
    expect(reduced.has("finish_framer_work")).toBe(true);
  });
});
