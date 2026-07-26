import { createHash } from "node:crypto";
import path from "node:path";
import { CORE_GUIDANCE_AGENTS, CORE_GUIDANCE_SYSTEM } from "./guidance-instructions.js";

export const FRAMER_GUIDANCE_SCHEMA_VERSION = 3;
export const FRAMER_GUIDANCE_COMPILER_VERSION = "3.0.0";
export const FRAMER_GUIDANCE_AGENTS_MARKER = "<!-- lottus-agents-v10 -->";

export interface GuidanceSourceFile {
  path: string;
  content: string;
}

export interface UpstreamBundle {
  files: GuidanceSourceFile[];
}

export interface CompileFramerGuidanceInput {
  framerAgentVersion: string;
  projectId: string;
  sessionId: string;
  upstreamBundle: UpstreamBundle;
  systemAdditions?: GuidanceHostAddition[];
  agentAdditions?: GuidanceHostAddition[];
}

export interface GuidanceHostAddition {
  id: string;
  content: string;
  provenance: string;
  redistribution?: "approved" | "runtime-only";
}

export interface GuidanceCoverageEntry {
  sourcePath: string;
  section: string;
  sourceHash: string;
  disposition: "mapped" | "excluded" | "fallback";
  outputs: string[];
  reason?: string;
}

export interface GuidanceManifest {
  schemaVersion: number;
  compilerVersion: string;
  framerAgentVersion: string;
  projectId: string;
  sessionId: string;
  sourceAdapter: "v38-project-bundle" | "unknown-fallback";
  fallback: boolean;
  warnings: string[];
  upstream: {
    promptHash: string;
    contextHash: string;
    files: Array<{ path: string; sha256: string; bytes: number; rawPath: string }>;
  };
  materials: Array<{
    id: string;
    provenance: "lottus-owned" | "runtime-upstream" | "host-supplied";
    redistribution: "approved" | "runtime-only";
    source: string;
    sha256: string;
  }>;
  coverage: GuidanceCoverageEntry[];
  outputs: Array<{ path: string; sha256: string; bytes: number }>;
  contentHash: string;
}

export interface CompiledFramerGuidance {
  system: string;
  agents: string;
  files: GuidanceSourceFile[];
  manifest: GuidanceManifest;
  contentHash: string;
}

interface SourceDocument {
  path: string;
  content: string;
  kind: "prompt" | "base" | "code" | "recipes" | "start" | "inventory";
}

interface AdaptedSource {
  adapter: GuidanceManifest["sourceAdapter"];
  fallback: boolean;
  warnings: string[];
  documents: SourceDocument[];
  inventory?: SourceDocument;
  promptHash: string;
  contextHash: string;
}

interface MarkdownChunk {
  title: string;
  level: number;
  parents: string[];
  content: string;
}

interface ReferencePart {
  sourcePath: string;
  section: string;
  content: string;
}

const EXPECTED_REFERENCES = [
  "reference/core/general.md",
  "reference/core/guardrails.md",
  "reference/core/design-rules.md",
  "reference/principles/general.md",
  "reference/principles/layout.md",
  "reference/principles/text.md",
  "reference/principles/cms.md",
  "reference/principles/interactions.md",
  "reference/strategy/creation.md",
  "reference/strategy/edit.md",
  "reference/strategy/recreation.md",
  "reference/strategy/planning.md",
  "reference/strategy/verification.md",
  "reference/tools/inspect.md",
  "reference/tools/controls.md",
  "reference/tools/apply.md",
  "reference/tools/publish.md",
  "reference/tools/images.md",
  "reference/tools/code.md",
  "reference/tools/project-data.md",
  "reference/dsl/base.md",
  "reference/dsl/layout.md",
  "reference/dsl/text.md",
  "reference/dsl/cms.md",
  "reference/dsl/components.md",
  "reference/dsl/interactions.md",
  "reference/dsl/effects.md",
  "reference/dsl/computed-values.md",
  "reference/project/scopes.md",
  "reference/project/layout.md",
  "reference/project/components.md",
  "reference/project/cms.md",
  "reference/project/variables.md",
  "reference/project/interactions.md",
  "reference/project/rich-text.md",
  "reference/project/links.md",
  "reference/project/project-data.md",
  "reference/guides/index.md",
  "reference/code/authoring.md",
  "reference/code/controls-overview.md",
  "reference/start-conversation.md",
  "reference/limitations.md",
] as const;

const CODE_CONTROL_NAMES = [
  "boolean", "number", "string", "enum", "color", "responsive-image", "file", "array", "slot",
  "event-handler", "font", "transition", "box-shadow", "link", "date", "object", "border", "cursor",
  "padding", "border-radius", "gap", "tracking-id",
] as const;

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function withFinalNewline(content: string): string {
  return `${content.trimEnd()}\n`;
}

function normalizeCommands(content: string): string {
  const normalized = content
    .replaceAll("npx --min-release-age=0 @framer/agent@latest", "agent")
    .replaceAll("npx --min-release-age=0 @framer/agent", "agent")
    .replaceAll("npx @framer/agent@latest", "agent")
    .replaceAll("npx @framer/agent", "agent");
  return normalized.split("\n").map((line) =>
    /\bagent\s+(?:setup|session\s+(?:new|list|destroy)|project\s+auth|relay\b)/i.test(line)
      ? "<!-- Lottus excluded an upstream setup/session/relay instruction; the runtime contract owns this operation. -->"
      : line
  ).join("\n");
}

function logicalRawPath(index: number, sourcePath: string): string {
  const basename = path.posix.basename(sourcePath.replaceAll("\\", "/")).replace(/[^A-Za-z0-9._-]/g, "-") || "source.md";
  return `.lottus/framer/upstream/raw/${String(index + 1).padStart(2, "0")}-${sha256(sourcePath).slice(0, 8)}-${basename}`;
}

function splitTopLevelPrompt(markdown: string): GuidanceSourceFile[] {
  const normalized = markdown.replaceAll("\r\n", "\n");
  const result: GuidanceSourceFile[] = [];
  let title = "Preamble";
  let lines: string[] = [];
  const seen = new Map<string, number>();
  const flush = () => {
    const content = lines.join("\n").trim();
    if (!content && title === "Preamble") return;
    const base = slug(title) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    result.push({ path: `prompt/${id}.md`, content: withFinalNewline(`# ${title}\n\n${content}`) });
  };
  for (const line of normalized.split("\n")) {
    const heading = line.match(/^#\s+(.+?)\s*#*\s*$/u);
    if (heading) {
      flush();
      title = heading[1]!.trim();
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return result;
}

function findV38Metadata(files: GuidanceSourceFile[]): GuidanceSourceFile | undefined {
  return files.find((file) => /(?:^|\/)metadata\.json$/.test(file.path) && files.some((candidate) => candidate.path.includes("/prompt/") || candidate.path.startsWith("prompt/")));
}

function missingRequiredPromptSections(prompt: string): string[] {
  return ["Tools", "Updating the Project", "Core Principles", "How Projects Work"]
    .filter((heading) => !new RegExp(`^# ${heading}\\s*$`, "imu").test(prompt));
}

/** Bundle source adapter for @framer/agent 0.0.38 generated project directories. */
function adaptV38ProjectBundle(bundle: UpstreamBundle): AdaptedSource | undefined {
  const metadataFile = findV38Metadata(bundle.files);
  if (!metadataFile) return undefined;
  let metadata: { contextSchemaVersion?: number; promptHash?: string; contextHash?: string };
  try {
    metadata = JSON.parse(metadataFile.content) as typeof metadata;
  } catch {
    return {
      adapter: "unknown-fallback", fallback: true,
      warnings: ["Generated Framer project metadata is not valid JSON; retained complete upstream fallback."],
      documents: supportingDocumentsForUnknown(bundle.files), promptHash: "", contextHash: "",
    };
  }
  if (metadata.contextSchemaVersion !== 1) {
    return {
      adapter: "unknown-fallback", fallback: true,
      warnings: [`Unknown Framer project context schema ${String(metadata.contextSchemaVersion)}; retained complete upstream fallback.`],
      documents: supportingDocumentsForUnknown(bundle.files),
      promptHash: metadata.promptHash ?? "",
      contextHash: metadata.contextHash ?? "",
    };
  }
  const projectPrefix = metadataFile.path.slice(0, -"metadata.json".length);
  const promptFiles = bundle.files
    .filter((file) => file.path.startsWith(`${projectPrefix}prompt/`) && file.path.endsWith(".md"))
    .sort((a, b) => a.path.localeCompare(b.path));
  const inventoryFile = bundle.files.find((file) => file.path === `${projectPrefix}project-inventory.md`);
  if (!promptFiles.length || !inventoryFile) {
    return {
      adapter: "unknown-fallback", fallback: true,
      warnings: ["Generated Framer project bundle is incomplete; retained complete upstream fallback."],
      documents: supportingDocumentsForUnknown(bundle.files),
      promptHash: metadata.promptHash ?? "",
      contextHash: metadata.contextHash ?? "",
    };
  }
  const combinedPrompt = promptFiles.map((file) => file.content).join("\n\n");
  const missingSections = missingRequiredPromptSections(combinedPrompt);
  if (missingSections.length) {
    return {
      adapter: "unknown-fallback", fallback: true,
      warnings: [`Framer prompt structure is missing required sections (${missingSections.join(", ")}); retained complete upstream fallback.`],
      documents: supportingDocumentsForUnknown(bundle.files),
      promptHash: metadata.promptHash ?? sha256(combinedPrompt),
      contextHash: metadata.contextHash ?? sha256(inventoryFile.content),
    };
  }
  const documents: SourceDocument[] = promptFiles.map((file) => ({ ...file, kind: "prompt" }));
  for (const file of bundle.files) {
    if (file.path === `${projectPrefix}recipes.md`) documents.push({ ...file, kind: "recipes" });
  }
  addSupportingDocuments(bundle.files, metadataFile.path, documents);
  return {
    adapter: "v38-project-bundle",
    fallback: false,
    warnings: [],
    documents,
    inventory: { ...inventoryFile, kind: "inventory" },
    promptHash: metadata.promptHash ?? sha256(promptFiles.map((file) => file.content).join("\n")),
    contextHash: metadata.contextHash ?? sha256(inventoryFile.content),
  };
}

function addSupportingDocuments(files: GuidanceSourceFile[], projectPath: string, documents: SourceDocument[]): void {
  for (const file of files) {
    if (file.path === projectPath) continue;
    const normalized = file.path.replaceAll("\\", "/");
    if (/framer-code-components\/SKILL\.md$/i.test(normalized)) documents.push({ ...file, kind: "code" });
    else if (/framer\/start-conversation\.md$/i.test(normalized)) documents.push({ ...file, kind: "start" });
    else if (/framer\/SKILL\.md$/i.test(normalized)) documents.push({ ...file, kind: "base" });
  }
}

function supportingDocumentsForUnknown(files: GuidanceSourceFile[]): SourceDocument[] {
  return files
    .filter((file) => file.path.endsWith(".md"))
    .map((file) => ({ ...file, kind: /code-components/i.test(file.path) ? "code" : "prompt" }));
}

function adaptSource(bundle: UpstreamBundle): AdaptedSource {
  return adaptV38ProjectBundle(bundle) ?? {
    adapter: "unknown-fallback",
    fallback: true,
    warnings: ["No recognized generated Framer guidance schema was found; retained complete upstream fallback."],
    documents: supportingDocumentsForUnknown(bundle.files),
    promptHash: "",
    contextHash: "",
  };
}

function splitMarkdown(content: string): MarkdownChunk[] {
  const lines = content.replaceAll("\r\n", "\n").split("\n");
  const chunks: MarkdownChunk[] = [];
  const ancestry: Array<{ level: number; title: string }> = [];
  let current: MarkdownChunk | undefined;
  let currentLines: string[] = [];
  let fenced = false;
  const flush = () => {
    if (!current) {
      const preamble = currentLines.join("\n").trim();
      if (preamble) chunks.push({ title: "Preamble", level: 0, parents: [], content: preamble });
    } else {
      chunks.push({ ...current, content: currentLines.join("\n").trim() });
    }
    currentLines = [];
  };
  for (const line of lines) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = !fenced ? line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u) : null;
    if (!heading) {
      currentLines.push(line);
      continue;
    }
    flush();
    const level = heading[1]!.length;
    while (ancestry.length && ancestry[ancestry.length - 1]!.level >= level) ancestry.pop();
    current = { title: heading[2]!.trim(), level, parents: ancestry.map((entry) => entry.title), content: "" };
    ancestry.push({ level, title: current.title });
    currentLines.push(line);
  }
  flush();
  return chunks;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function codeControlSlug(title: string): string | undefined {
  const normalized = slug(title.replace(/\s+control(?:\s+types?)?$/i, ""));
  const aliases: Record<string, string> = {
    responsiveimage: "responsive-image", "responsive-image": "responsive-image", eventhandler: "event-handler",
    "event-handler": "event-handler", boxshadow: "box-shadow", "box-shadow": "box-shadow",
    borderradius: "border-radius", "border-radius": "border-radius", trackingid: "tracking-id", "tracking-id": "tracking-id",
  };
  const resolved = aliases[normalized] ?? normalized;
  return CODE_CONTROL_NAMES.includes(resolved as typeof CODE_CONTROL_NAMES[number]) ? resolved : undefined;
}

function classifyCommandFragments(fragment: string): string[] {
  const text = fragment.toLowerCase();
  const targets: string[] = [];
  if (/collection|cms|variable|redirectnode|webpagenode/.test(text)) targets.push("reference/dsl/cms.md");
  if (/textrun|textblock|richtext|font|typography|linkstyle|blockquote|tablestyle|textmedia/.test(text)) targets.push("reference/dsl/text.md");
  if (/form|overlay|eventhandler|event-handler|action|transition/.test(text)) targets.push("reference/dsl/interactions.md");
  if (/component|iconnode|shader|variant|preset/.test(text)) targets.push("reference/dsl/components.md");
  if (/effect|parallax|ticker|lightbox|scrolltarget|drag|hover|tap/.test(text)) targets.push("reference/dsl/effects.md");
  if (/frame|layout|width|height|padding|grid|stack|position|overflow|radius|border|fill/.test(text)) targets.push("reference/dsl/layout.md");
  return targets.length ? [...new Set(targets)] : ["reference/dsl/base.md"];
}

function splitCommandGrammar(chunk: MarkdownChunk): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const push = (target: string, value: string) => {
    const values = result.get(target) ?? [];
    values.push(value);
    result.set(target, values);
  };
  const fence = chunk.content.match(/```[^\n]*\n([\s\S]*?)\n```/u);
  if (!fence) {
    push("reference/dsl/base.md", chunk.content);
    return result;
  }
  const before = chunk.content.slice(0, fence.index).trim();
  const after = chunk.content.slice((fence.index ?? 0) + fence[0].length).trim();
  if (before) push("reference/dsl/base.md", before);
  for (const line of fence[1]!.split("\n")) {
    const fragments = line.startsWith("SET ") ? line.split(/(?=\/\* )/u) : [line];
    for (const fragment of fragments) {
      if (!fragment.trim()) continue;
      for (const target of classifyCommandFragments(fragment)) {
        push(target, `\`\`\`text\n${fragment.trim()}\n\`\`\``);
      }
    }
  }
  if (after) push("reference/dsl/base.md", after);
  return result;
}

function splitPrinciples(chunk: MarkdownChunk): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const lines = chunk.content.split("\n");
  const heading = lines.shift();
  let block: string[] = heading ? [heading] : [];
  const flush = () => {
    const content = block.join("\n").trim();
    if (!content) return;
    const lower = content.toLowerCase();
    let target = "reference/principles/general.md";
    if (/cms|collection|variable/.test(lower)) target = "reference/principles/cms.md";
    else if (/text|font|typograph|rich/.test(lower)) target = "reference/principles/text.md";
    else if (/form|overlay|interaction|effect|transition/.test(lower)) target = "reference/principles/interactions.md";
    else if (/layout|width|height|padding|spacing|stack|grid|overflow|container|fill|surface|z-index|responsive/.test(lower)) target = "reference/principles/layout.md";
    const values = result.get(target) ?? [];
    values.push(content);
    result.set(target, values);
  };
  for (const line of lines) {
    if (/^-\s+/.test(line)) {
      flush();
      block = [line];
    } else {
      block.push(line);
    }
  }
  flush();
  return result;
}

function exampleTarget(content: string, code = false): string {
  const lower = content.toLowerCase();
  let family = "general";
  if (/cms|collection/.test(lower)) family = "cms";
  else if (/richtext|textblock|font|typograph/.test(lower)) family = "text";
  else if (/form|overlay|event|interaction|animation|transition/.test(lower)) family = "interactions";
  else if (/component|variant|icon|shader/.test(lower)) family = "components";
  else if (/page|frame|layout|section|grid|stack/.test(lower)) family = "layout";
  return `reference/${code ? "code/" : ""}examples/${family}.md`;
}

function classifyChunk(document: SourceDocument, chunk: MarkdownChunk): { outputs: Map<string, string[]>; disposition?: "excluded"; reason?: string } {
  const outputs = new Map<string, string[]>();
  const add = (target: string, content = chunk.content) => outputs.set(target, [...(outputs.get(target) ?? []), content]);
  const title = chunk.title.toLowerCase();
  const parents = chunk.parents.join(" / ").toLowerCase();
  const combined = `${parents} / ${title}`;

  if (/reviewchanges|framer_review_changes/.test(chunk.content.toLowerCase())) {
    return { outputs, disposition: "excluded", reason: "Obsolete review-loop guidance is superseded by inline apply diagnostics; retained verbatim in upstream fallback." };
  }

  if (document.kind === "base") {
    return { outputs, disposition: "excluded", reason: "Lottus privately owns setup, authorization, relay, and session management; the runtime contract supersedes this model-facing workflow." };
  }
  if (document.kind === "start") {
    add("reference/start-conversation.md");
    return { outputs };
  }
  if (document.kind === "code") {
    if (/framer code component examples/.test(combined) || parents.includes("framer code component examples")) {
      add(exampleTarget(chunk.content, true));
      return { outputs };
    }
    const control = codeControlSlug(chunk.title);
    if (control && (/framer property controls|control type|property control guide/.test(combined))) {
      add(`reference/code/controls/${control}.md`);
      return { outputs };
    }
    const guideControl: Record<string, string> = { colors: "color", images: "responsive-image", typography: "font", "file types": "file" };
    if (parents.includes("property control guide") && guideControl[title]) {
      add(`reference/code/controls/${guideControl[title]}.md`);
      return { outputs };
    }
    if (/property controls|property control types|property control guide|table of contents|composite types|control type interfaces|deprecated controls|controltype\./.test(combined)) add("reference/code/controls-overview.md");
    else add("reference/code/authoring.md");
    return { outputs };
  }
  if (document.kind === "recipes") {
    if (/known limitations/.test(title)) add("reference/limitations.md");
    else if (/cms/.test(title)) add("reference/project/cms.md");
    else if (/image/.test(title)) add("reference/tools/images.md");
    else if (/localization|plugin data/.test(title)) add("reference/tools/project-data.md");
    else add("reference/core/general.md");
    return { outputs };
  }
  if (/command syntax/.test(title)) return { outputs: splitCommandGrammar(chunk) };
  if (/computed values/.test(title)) { add("reference/dsl/computed-values.md"); return { outputs }; }
  if (title === "core principles") return { outputs: splitPrinciples(chunk) };
  if (/core examples/.test(combined)) {
    for (const example of chunk.content.split(/\n---\s*\n/u).filter((part) => part.trim())) add(exampleTarget(example), example.trim());
    return { outputs };
  }
  if (/known limitations/.test(title)) { add("reference/limitations.md"); return { outputs }; }
  if (/critical reminders|overview/.test(title)) { add("reference/core/general.md"); return { outputs }; }
  if (/guardrails/.test(title)) { add("reference/core/guardrails.md"); return { outputs }; }
  if (/design rules|typography|logos|spacing|colors|surfaces/.test(combined) && (parents.includes("design rules") || title === "design rules")) { add("reference/core/design-rules.md"); return { outputs }; }

  if (/update loop/.test(title)) {
    add("reference/tools/apply.md");
    add("reference/strategy/verification.md");
    return { outputs };
  }

  if (/recreation strategy/.test(combined)) add("reference/strategy/recreation.md");
  else if (/creation strategy|capture creative direction|requesting fonts|density|aesthetic|layouts/.test(combined) && parents.includes("implementation strategy")) add("reference/strategy/creation.md");
  else if (/edit strategy|how to/.test(combined) && parents.includes("implementation strategy")) add("reference/strategy/edit.md");
  else if (/determining strategy|design plan|guides|implementation strategy/.test(title)) add("reference/strategy/planning.md");
  else if (/update loop|implement and review|visual verification/.test(combined)) add("reference/strategy/verification.md");
  else if (/control lookup/.test(title)) add("reference/tools/controls.md");
  else if (/tree inspection|readproject|read project|serialize|definitions|execute code|shell quoting|api documentation/.test(combined) && parents.includes("tools")) add("reference/tools/inspect.md");
  else if (/applychanges|replacing text|update loop/.test(title)) add("reference/tools/apply.md");
  else if (/publish/.test(title)) add("reference/tools/publish.md");
  else if (/queryimages/.test(title)) add("reference/tools/images.md");
  else if (/flattencomponent|makeexternalcomponent/.test(title)) add("reference/tools/code.md");
  else if (title === "tools") add("reference/tools/inspect.md");
  else if (/scope types|replicas/.test(combined)) add("reference/project/scopes.md");
  else if (/layout templates|layout recipe|positioning|width rules/.test(combined)) add("reference/project/layout.md");
  else if (/icons|components|shaders/.test(title) || parents.includes("components")) add("reference/project/components.md");
  else if (/cms|collection/.test(combined)) add("reference/project/cms.md");
  else if (/variables|variable types|webpage variables|optional variables/.test(combined)) add("reference/project/variables.md");
  else if (/forms|transitions|overlays|event handlers|actions/.test(combined)) add("reference/project/interactions.md");
  else if (/rich text/.test(combined)) add("reference/project/rich-text.md");
  else if (/links/.test(title)) add("reference/project/links.md");
  else if (/hosting|redirects|rewrites|localization|a\/b testing/.test(combined)) add("reference/project/project-data.md");
  else if (/implementation guidance documentation index/.test(combined)) add("reference/guides/index.md");
  else add("reference/core/general.md");
  return { outputs };
}

function outputTitle(relativePath: string): string {
  return relativePath
    .replace(/^reference\//, "")
    .replace(/\.md$/, "")
    .split("/")
    .map((part) => part.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "))
    .join(" — ");
}

function inventoryTarget(tag: string): string {
  const lower = tag.toLowerCase();
  if (/site.?map|page/.test(lower)) return "project/site-map.md";
  if (/font|style|color|token/.test(lower)) return "project/fonts-and-styles.md";
  if (/component|code-file|external/.test(lower)) return "project/components.md";
  if (/cms|collection/.test(lower)) return "project/cms.md";
  if (/icon|shader/.test(lower)) return "project/icons-and-shaders.md";
  return "project/index.md";
}

function appendPart(parts: Map<string, ReferencePart[]>, target: string, part: ReferencePart): void {
  parts.set(target, [...(parts.get(target) ?? []), part]);
}

function renderReference(relativePath: string, parts: ReferencePart[]): string {
  const body = parts.map((part) => [
    `## Source: ${part.sourcePath} — ${part.section}`,
    "",
    normalizeCommands(part.content).trim(),
  ].join("\n")).join("\n\n---\n\n");
  return withFinalNewline(`# ${outputTitle(relativePath)}\n\n> Authoritative upstream excerpts selected mechanically by Lottus. Provenance is retained per section.\n\n${body}`);
}

function makeProjectIndex(input: CompileFramerGuidanceInput, inventoryPresent: boolean): string {
  return withFinalNewline(`# Framer Project Inventory\n\n- Project ID: ${input.projectId}\n- Inventory source present: ${inventoryPresent ? "yes" : "no"}\n\nThis is an orientation snapshot generated when the Framer session connected. Read only the relevant shard, then query live state before relying on mutable names or IDs.\n\nAvailable shards: \`site-map.md\`, \`fonts-and-styles.md\`, \`components.md\`, \`cms.md\`, and \`icons-and-shaders.md\`.`);
}

function renderAgents(input: CompileFramerGuidanceInput, fallback: boolean): string {
  const sections = [
    FRAMER_GUIDANCE_AGENTS_MARKER,
    CORE_GUIDANCE_AGENTS.replaceAll("{{FRAMER_AGENT_VERSION}}", input.framerAgentVersion).trim(),
  ];
  if (fallback) sections.push("## Upstream compatibility fallback\n\nThe Framer guidance schema was not recognized. Before any Framer technical operation, read `.lottus/framer/reference/fallback.md`. It is intentionally large but complete. Do not use empty placeholder shards as authority.");
  for (const addition of input.agentAdditions ?? []) {
    if (addition.content.trim()) sections.push(addition.content.trim());
  }
  sections.push(["## Live Framer Session", "", "- Framer Control Tools inject the preauthorized, health-checked connection.", "- Never seek, supply, or manage a session ID.", "- The runtime validates the guidance manifest privately."].join("\n"));
  return withFinalNewline(sections.join("\n\n"));
}

function renderSystem(input: CompileFramerGuidanceInput): string {
  const additions = (input.systemAdditions ?? []).map((addition) => addition.content.trim()).filter(Boolean);
  return withFinalNewline([CORE_GUIDANCE_SYSTEM, ...additions].join("\n\n"));
}

function contentHashFor(outputs: GuidanceSourceFile[]): string {
  return sha256(outputs
    .map((file) => ({ path: file.path, sha256: sha256(file.content) }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}:${file.sha256}`)
    .join("\n"));
}

export function compileFramerGuidance(input: CompileFramerGuidanceInput): CompiledFramerGuidance {
  const upstreamBundle = {
    files: input.upstreamBundle.files.slice().sort((a, b) => a.path.localeCompare(b.path) || a.content.localeCompare(b.content)),
  };
  const adapted = adaptSource(upstreamBundle);
  const parts = new Map<string, ReferencePart[]>();
  const coverage: GuidanceCoverageEntry[] = [];
  const rawFiles: GuidanceSourceFile[] = upstreamBundle.files.map((file, index) => ({
    path: logicalRawPath(index, file.path),
    content: file.content,
  }));
  const rawPathBySource = new Map(upstreamBundle.files.map((file, index) => [file.path, rawFiles[index]!.path]));
  for (const file of upstreamBundle.files) {
    coverage.push({
      sourcePath: file.path,
      section: "<verbatim source>",
      sourceHash: sha256(file.content),
      disposition: "fallback",
      outputs: [rawPathBySource.get(file.path)!],
    });
  }

  for (const document of adapted.documents) {
    for (const chunk of splitMarkdown(document.content)) {
      const classification = classifyChunk(document, chunk);
      const mappedOutputs: string[] = [];
      for (const [target, contents] of classification.outputs) {
        for (const content of contents) appendPart(parts, target, { sourcePath: document.path, section: chunk.title, content });
        mappedOutputs.push(`.lottus/framer/${target}`);
      }
      coverage.push({
        sourcePath: document.path,
        section: chunk.title,
        sourceHash: sha256(chunk.content),
        disposition: classification.disposition ?? (mappedOutputs.length ? "mapped" : "fallback"),
        outputs: mappedOutputs.length ? mappedOutputs : [rawPathBySource.get(document.path.split("#")[0]!) ?? ".lottus/framer/reference/fallback.md"],
        ...(classification.reason ? { reason: classification.reason } : {}),
      });
    }
  }

  const projectFiles = new Map<string, ReferencePart[]>();
  if (adapted.inventory) {
    const inventory = adapted.inventory.content;
    const tagPattern = /<([A-Za-z][A-Za-z0-9_-]*)>([\s\S]*?)<\/\1>/gu;
    let match: RegExpExecArray | null;
    let matched = false;
    while ((match = tagPattern.exec(inventory))) {
      matched = true;
      const exact = match[0];
      const target = inventoryTarget(match[1]!);
      appendPart(projectFiles, target, { sourcePath: adapted.inventory.path, section: `<${match[1]}>`, content: exact });
      coverage.push({ sourcePath: adapted.inventory.path, section: `<${match[1]}>`, sourceHash: sha256(exact), disposition: "mapped", outputs: [`.lottus/framer/${target}`] });
    }
    if (!matched) {
      appendPart(projectFiles, "project/index.md", { sourcePath: adapted.inventory.path, section: "Inventory", content: inventory });
      coverage.push({ sourcePath: adapted.inventory.path, section: "Inventory", sourceHash: sha256(inventory), disposition: "mapped", outputs: [".lottus/framer/project/index.md"] });
    }
  }

  const generatedFiles: GuidanceSourceFile[] = [];
  for (const expected of [...EXPECTED_REFERENCES, ...CODE_CONTROL_NAMES.map((name) => `reference/code/controls/${name}.md`)]) {
    const referenceParts = parts.get(expected);
    generatedFiles.push({
      path: `.lottus/framer/${expected}`,
      content: referenceParts?.length
        ? renderReference(expected, referenceParts)
        : withFinalNewline(`# ${outputTitle(expected)}\n\nNo matching section was emitted by the recognized upstream source. Consult the task router or the upstream fallback index; do not invent grammar.`),
    });
  }
  for (const [relativePath, referenceParts] of [...parts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (EXPECTED_REFERENCES.includes(relativePath as typeof EXPECTED_REFERENCES[number]) || relativePath.startsWith("reference/code/controls/")) continue;
    generatedFiles.push({ path: `.lottus/framer/${relativePath}`, content: renderReference(relativePath, referenceParts) });
  }

  const baseProjectIndex = makeProjectIndex(input, Boolean(adapted.inventory));
  for (const projectName of ["project/index.md", "project/site-map.md", "project/fonts-and-styles.md", "project/components.md", "project/cms.md", "project/icons-and-shaders.md"]) {
    const projectParts = projectFiles.get(projectName) ?? [];
    const rendered = projectParts.length ? renderReference(projectName, projectParts) : withFinalNewline(`# ${outputTitle(projectName)}\n\nNo matching inventory data was present in the generated snapshot.`);
    generatedFiles.push({ path: `.lottus/framer/${projectName}`, content: projectName === "project/index.md" ? `${baseProjectIndex.trimEnd()}\n\n${rendered}` : rendered });
  }

  const fallbackBody = adapted.fallback
    ? upstreamBundle.files.map((file) => `# Source: ${file.path}\n\n${file.content}`).join("\n\n---\n\n")
    : ["# Upstream fallback index", "", "Use only when a focused routed shard is missing required material.", "", ...rawFiles.map((file) => `- \`${file.path}\``)].join("\n");
  generatedFiles.push({ path: ".lottus/framer/reference/fallback.md", content: withFinalNewline(fallbackBody) });
  generatedFiles.push(...rawFiles);
  generatedFiles.push({
    path: ".lottus/framer/upstream/metadata.json",
    content: `${JSON.stringify({ adapter: adapted.adapter, fallback: adapted.fallback, warnings: adapted.warnings, promptHash: adapted.promptHash, contextHash: adapted.contextHash }, null, 2)}\n`,
  });

  const system = renderSystem(input);
  const agents = renderAgents(input, adapted.fallback);
  const allOutputs = [{ path: ".pi/SYSTEM.md", content: system }, { path: "AGENTS.md", content: agents }, ...generatedFiles];
  const contentHash = contentHashFor(allOutputs);
  const manifest: GuidanceManifest = {
    schemaVersion: FRAMER_GUIDANCE_SCHEMA_VERSION,
    compilerVersion: FRAMER_GUIDANCE_COMPILER_VERSION,
    framerAgentVersion: input.framerAgentVersion,
    projectId: input.projectId,
    sessionId: input.sessionId,
    sourceAdapter: adapted.adapter,
    fallback: adapted.fallback,
    warnings: adapted.warnings,
    upstream: {
      promptHash: adapted.promptHash,
      contextHash: adapted.contextHash,
      files: upstreamBundle.files.map((file, index) => ({ path: file.path, sha256: sha256(file.content), bytes: Buffer.byteLength(file.content), rawPath: rawFiles[index]!.path })),
    },
    materials: [
      { id: "core:SYSTEM", provenance: "lottus-owned", redistribution: "approved", source: "Lottus Framer Agent Core", sha256: sha256(CORE_GUIDANCE_SYSTEM) },
      { id: "core:AGENTS", provenance: "lottus-owned", redistribution: "approved", source: "Lottus Framer Agent Core", sha256: sha256(CORE_GUIDANCE_AGENTS) },
      ...upstreamBundle.files.map((file) => ({ id: file.path, provenance: "runtime-upstream" as const, redistribution: "runtime-only" as const, source: file.path, sha256: sha256(file.content) })),
      ...(input.systemAdditions ?? []).map((addition) => ({ id: addition.id, provenance: "host-supplied" as const, redistribution: addition.redistribution ?? "runtime-only", source: addition.provenance, sha256: sha256(addition.content) })),
      ...(input.agentAdditions ?? []).map((addition) => ({ id: addition.id, provenance: "host-supplied" as const, redistribution: addition.redistribution ?? "runtime-only", source: addition.provenance, sha256: sha256(addition.content) })),
    ],
    coverage,
    outputs: allOutputs.map((file) => ({ path: file.path, sha256: sha256(file.content), bytes: Buffer.byteLength(file.content) })).sort((a, b) => a.path.localeCompare(b.path)),
    contentHash,
  };
  return { system, agents, files: generatedFiles, manifest, contentHash };
}
