import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repo = resolve(import.meta.dirname, "..");
const fixture = await mkdtemp(join(tmpdir(), "lottus-framer-core-pack-"));
try {
  const packed = JSON.parse((await exec("npm", ["pack", "--json", "--pack-destination", fixture], { cwd: repo })).stdout);
  const artifact = packed[0];
  const tarball = join(fixture, artifact.filename);
  const redistribution = JSON.parse(await readFile(join(repo, "redistribution-manifest.json"), "utf8"));
  const approvedMarkdown = new Set(redistribution.markdown
    .filter((entry) => entry.redistribution === "approved" && typeof entry.provenance === "string" && entry.provenance.trim())
    .map((entry) => entry.path));
  const packedMarkdown = artifact.files.map((file) => file.path).filter((path) => path.toLowerCase().endsWith(".md"));
  const unaudited = packedMarkdown.filter((path) => !approvedMarkdown.has(path));
  const missing = [...approvedMarkdown].filter((path) => !packedMarkdown.includes(path));
  if (unaudited.length || missing.length) {
    throw new Error(`Core redistribution Markdown audit failed. Unaudited: ${unaudited.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`);
  }
  await writeFile(join(fixture, "package.json"), JSON.stringify({ name: "clean-core-fixture", private: true, type: "module" }));
  await exec("npm", [
    "install",
    "--ignore-scripts",
    "--no-package-lock",
    tarball,
    "@earendil-works/pi-ai@0.80.6",
    "@earendil-works/pi-coding-agent@0.80.6",
    "typebox@1.1.38",
  ], { cwd: fixture, maxBuffer: 10 * 1024 * 1024 });
  const probe = `
    import * as root from "@lottus-agent/framer-core";
    import * as contracts from "@lottus-agent/framer-core/contracts";
    import * as pi from "@lottus-agent/framer-core/pi";
    import * as testing from "@lottus-agent/framer-core/testing";
    const tools = testing.captureExtensionTools(pi.createFramerAgentCoreExtension({ createQuestionId: () => "packed" }));
    const compiled = root.compileFramerGuidance({ framerAgentVersion: "test", projectId: "p", sessionId: "s", upstreamBundle: { files: [{ path: "unknown.md", content: "# Runtime only" }] } });
    if (!root.askUserSchema || !root.createFramerCodeFilesExtension || !root.parseCodeFileEvidence || !root.CORE_GUIDANCE_SYSTEM || !compiled.manifest.fallback || !contracts.isDesignQuestionDetails || !tools.has("ask_user")) process.exit(1);
  `;
  await exec(process.execPath, ["--input-type=module", "--eval", probe], { cwd: fixture });
  process.stdout.write(`Packed artifact verified in clean fixture: ${tarball}\n`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}
