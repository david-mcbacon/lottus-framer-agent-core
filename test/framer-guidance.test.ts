import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compileFramerGuidance,
  type CompileFramerGuidanceInput,
  type GuidanceSourceFile,
} from "../src/index.js";

const prompt = [
  "# Tools",
  "## Tree Inspection",
  "Use readProject and serialize.",
  "# Updating the Project",
  "## Update Loop",
  "Use applyChanges, then verify.",
  "# Core Principles",
  "- Preserve layout and typography.",
  "# How Projects Work",
  "## Scope Types",
  "Pages contain frames.",
].join("\n");

function recognizedFiles(): GuidanceSourceFile[] {
  return [
    { path: "framer/projects/demo/metadata.json", content: JSON.stringify({ contextSchemaVersion: 1 }) },
    { path: "framer/projects/demo/prompt/main.md", content: prompt },
    { path: "framer/projects/demo/project-inventory.md", content: '<pages><page name="Home" /></pages><fonts><font name="Inter" /></fonts>' },
    { path: "framer/start-conversation.md", content: "# Start Conversation\nDelegate only when asked." },
  ];
}

function input(files = recognizedFiles()): CompileFramerGuidanceInput {
  return {
    framerAgentVersion: "0.0.40",
    projectId: "demo",
    sessionId: "session-1",
    upstreamBundle: { files },
  };
}

describe("compileFramerGuidance public seam", () => {
  it("routes recognized guidance and Project Inventory shards with coverage", () => {
    const result = compileFramerGuidance(input());
    expect(result.manifest.sourceAdapter).toBe("v38-project-bundle");
    expect(result.manifest.fallback).toBe(true);
    expect(result.manifest.warnings.join(" ")).toContain("critical semantic routes");
    expect(result.files.find((file) => file.path.endsWith("reference/tools/inspect.md"))?.content).toContain("readProject");
    expect(result.files.find((file) => file.path.endsWith("project/site-map.md"))?.content).toContain("Home");
    expect(result.manifest.coverage.some((entry) => entry.disposition === "mapped")).toBe(true);
    expect(result.manifest.materials).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "core:SYSTEM", provenance: "lottus-owned", redistribution: "approved" }),
      expect.objectContaining({ id: "framer/projects/demo/prompt/main.md", provenance: "runtime-upstream", redistribution: "runtime-only" }),
    ]));
  });

  it("keeps every critical route reachable for the complete supported fixture", () => {
    const root = new URL("./fixtures/framer-agent-0.0.40/", import.meta.url);
    const files: GuidanceSourceFile[] = [
      { path: "framer/projects/demo/metadata.json", content: JSON.stringify({ contextSchemaVersion: 1 }) },
      { path: "framer/projects/demo/project-inventory.md", content: "<pages><page name=\"Home\" /></pages><fonts><font name=\"Inter\" /></fonts>" },
      ...readdirSync(new URL("prompt/", root)).map((name) => ({
        path: `framer/projects/demo/prompt/${name}`,
        content: readFileSync(new URL(`prompt/${name}`, root), "utf8"),
      })),
      { path: "framer/projects/demo/recipes.md", content: readFileSync(new URL("recipes.md", root), "utf8") },
    ];
    const result = compileFramerGuidance(input(files));
    expect(result.manifest.fallback).toBe(false);
    for (const route of ["tools/inspect", "tools/apply", "strategy/creation", "strategy/edit", "strategy/recreation", "strategy/planning", "strategy/verification", "project/scopes", "dsl/base", "guides/index"]) {
      const file = result.files.find((candidate) => candidate.path.endsWith(`reference/${route}.md`));
      expect(file?.content, route).toContain("## Source:");
    }
    expect(result.manifest.coverage.filter((entry) => entry.disposition === "mapped").every((entry) => entry.sourceHash && entry.outputs.length)).toBe(true);
  });

  it("normalizes camel, snake, kebab, and spaced headings before routing", () => {
    const variants = ["TreeInspection", "tree_inspection", "tree-inspection", "Tree Inspection"];
    for (const heading of variants) {
      const files = recognizedFiles().map((file) => file.path.endsWith("prompt/main.md")
        ? { ...file, content: prompt.replace("Tree Inspection", heading) }
        : file);
      const result = compileFramerGuidance(input(files));
      expect(result.files.find((file) => file.path.endsWith("reference/tools/inspect.md"))?.content, heading).toContain("readProject");
    }
  });

  it("preserves every malformed or incomplete source verbatim and warns", () => {
    const files = [
      { path: "framer/projects/demo/metadata.json", content: "not json" },
      { path: "framer/projects/demo/prompt/partial.md", content: "# Tools\npartial" },
      { path: "framer/projects/demo/project-inventory.md", content: "<pages>unterminated" },
    ];
    const result = compileFramerGuidance(input(files));
    expect(result.manifest.fallback).toBe(true);
    expect(result.manifest.warnings.join(" ")).toMatch(/not valid JSON|fallback/u);
    const fallback = result.files.find((file) => file.path.endsWith("reference/fallback.md"))?.content ?? "";
    for (const source of files) {
      const rawPath = result.manifest.upstream.files.find((entry) => entry.path === source.path)?.rawPath;
      expect(result.files.find((file) => file.path === rawPath)?.content).toBe(source.content);
      expect(fallback).toContain(source.content);
    }
  });

  it("layers host instructions without forking Core guidance and records provenance", () => {
    const result = compileFramerGuidance({
      ...input(),
      systemAdditions: [{ id: "desktop:git-policy", provenance: "Lottus Desktop", content: "## Local version history\nCommit coherent workspace changes." }],
      agentAdditions: [{ id: "desktop:files", provenance: "workspace", content: "## Files\nRead CONTEXT.md." }],
    });
    expect(result.system).toContain("Ask every unresolved design decision directly through `ask_user`");
    expect(result.system).toContain("## Local version history");
    expect(result.agents).toContain("never pass a directory");
    expect(result.agents).not.toContain("strategy/*.md");
    expect(result.agents).toContain("## Files");
    expect(result.manifest.materials).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "desktop:git-policy", provenance: "host-supplied", redistribution: "runtime-only" }),
      expect.objectContaining({ id: "desktop:files", provenance: "host-supplied", redistribution: "runtime-only" }),
    ]));
  });

  it("produces byte-stable output and content hashes", () => {
    const first = compileFramerGuidance(input());
    const second = compileFramerGuidance(input(recognizedFiles().reverse()));
    expect(second).toEqual(first);
    expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.manifest.contentHash).toBe(first.contentHash);
  });

  it("does not distribute Framer-derived task markdown", () => {
    const result = compileFramerGuidance(input());
    expect(result.files.some((file) => file.path.includes("/tasks/"))).toBe(false);
  });
});
