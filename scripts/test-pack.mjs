import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repo = resolve(import.meta.dirname, "..");
const fixture = await mkdtemp(join(tmpdir(), "lottus-framer-core-pack-"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const sourcePackage = JSON.parse(await readFile(join(repo, "package.json"), "utf8"));
  assert(sourcePackage.license === "MIT", "Package license must be MIT.");
  assert(sourcePackage.engines?.node === ">=20", "Package must declare its supported Node environment.");
  const isPrerelease = sourcePackage.version.includes("-");
  const publishTag = sourcePackage.publishConfig?.tag;
  assert(publishTag, "Package must declare an explicit npm publish tag.");
  assert(
    isPrerelease ? publishTag !== "latest" : publishTag === "latest",
    isPrerelease ? "Prereleases must publish under a non-stable tag." : "Stable releases must publish under the latest tag.",
  );
  for (const dependency of ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent"]) {
    assert(sourcePackage.peerDependencies?.[dependency] === "0.80.6", `${dependency} must certify exactly Pi 0.80.6.`);
    assert(!sourcePackage.dependencies?.[dependency], `${dependency} must not be a bundled runtime dependency.`);
  }

  await exec("pnpm", ["build"], { cwd: repo });
  const packed = JSON.parse((await exec("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", fixture], {
    cwd: repo,
    maxBuffer: 10 * 1024 * 1024,
  })).stdout);
  const artifact = packed[0];
  const tarball = join(fixture, artifact.filename);
  assert(artifact.bundled.length === 0, "Packed artifact must not bundle dependencies.");
  const packedPaths = new Set(artifact.files.map((file) => file.path));
  for (const [name, targets] of Object.entries(sourcePackage.exports)) {
    assert(packedPaths.has(targets.import.slice(2)), `Export ${name} is missing its runtime file.`);
    assert(packedPaths.has(targets.types.slice(2)), `Export ${name} is missing its declaration file.`);
  }

  const allowedPaths = new Set(["LICENSE", "NOTICE.md", "README.md", "package.json", "redistribution-manifest.json"]);
  const sourceModules = (await readdir(join(repo, "src")))
    .filter((path) => path.endsWith(".ts"))
    .map((path) => path.slice(0, -3));
  for (const module of sourceModules) {
    for (const extension of ["js", "js.map", "d.ts", "d.ts.map"]) {
      allowedPaths.add(`dist/${module}.${extension}`);
    }
  }
  const unexpected = [...packedPaths].filter((path) => !allowedPaths.has(path));
  const missingAllowed = [...allowedPaths].filter((path) => !packedPaths.has(path));
  assert(unexpected.length === 0, `Packed artifact contains files outside the release allowlist: ${unexpected.join(", ")}`);
  assert(missingAllowed.length === 0, `Packed artifact is missing approved release files: ${missingAllowed.join(", ")}`);

  const redistribution = JSON.parse(await readFile(join(repo, "redistribution-manifest.json"), "utf8"));
  const approvedMarkdown = new Set(redistribution.markdown
    .filter((entry) => entry.redistribution === "approved" && typeof entry.provenance === "string" && entry.provenance.trim())
    .map((entry) => entry.path));
  const packedMarkdown = artifact.files.map((file) => file.path).filter((path) => path.toLowerCase().endsWith(".md"));
  const unaudited = packedMarkdown.filter((path) => !approvedMarkdown.has(path));
  const missing = [...approvedMarkdown].filter((path) => !packedMarkdown.includes(path));
  assert(unaudited.length === 0 && missing.length === 0, `Core redistribution Markdown audit failed. Unaudited: ${unaudited.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`);

  await writeFile(join(fixture, "package.json"), JSON.stringify({ name: "clean-core-fixture", private: true, type: "module" }));
  await exec("npm", [
    "install",
    "--ignore-scripts",
    "--no-package-lock",
    "@earendil-works/pi-ai@0.80.6",
    "@earendil-works/pi-coding-agent@0.80.6",
    "typebox@1.1.38",
  ], { cwd: fixture, maxBuffer: 10 * 1024 * 1024 });
  await exec("npm", ["install", "--ignore-scripts", "--no-package-lock", tarball], {
    cwd: fixture,
    maxBuffer: 10 * 1024 * 1024,
  });

  const probe = `
    import { access, realpath } from "node:fs/promises";
    import { fileURLToPath } from "node:url";
    import { dirname, join } from "node:path";
    import * as root from "@lottus-agent/framer-core";
    import * as contracts from "@lottus-agent/framer-core/contracts";
    import * as pi from "@lottus-agent/framer-core/pi";
    import * as guidance from "@lottus-agent/framer-core/guidance";
    import * as testing from "@lottus-agent/framer-core/testing";

    const tools = testing.captureExtensionTools(pi.createFramerAgentCoreExtension({ createQuestionId: () => "packed" }));
    const compiled = guidance.compileFramerGuidance({
      framerAgentVersion: "test",
      projectId: "p",
      sessionId: "s",
      upstreamBundle: { files: [{ path: "unknown.md", content: "# Runtime only" }] },
    });
    if (!root.createFramerAgentCoreExtension || !contracts.askUserSchema || !pi.createAskUserExtension || !guidance.CORE_GUIDANCE_SYSTEM || !testing.requireCapturedTool || !compiled.manifest.fallback || !tools.has("ask_user")) process.exit(1);

    const packageEntry = await realpath(fileURLToPath(import.meta.resolve("@lottus-agent/framer-core")));
    const packageRoot = dirname(dirname(packageEntry));
    for (const dependency of ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent", "typebox"]) {
      await import(dependency);
      const hostPath = await realpath(fileURLToPath(import.meta.resolve(dependency)));
      if (hostPath.startsWith(join(packageRoot, "node_modules"))) process.exit(2);
    }
    await access(join(packageRoot, "package.json"));
    try {
      await access(join(packageRoot, "node_modules"));
      process.exit(2);
    } catch {}
  `;
  await exec(process.execPath, ["--input-type=module", "--eval", probe], { cwd: fixture });

  const installedPackage = JSON.parse(await readFile(join(fixture, "node_modules/@lottus-agent/framer-core/package.json"), "utf8"));
  assert(Object.keys(installedPackage.exports).length === 5, "Fixture must exercise every documented package export.");
  process.stdout.write(`Packed artifact verified in clean fixture: ${tarball}\n`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}
