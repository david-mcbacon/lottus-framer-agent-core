export const SUPPORTED_FRAMER_AGENT_VERSIONS = ["0.0.40"] as const;
export const REQUIRED_FRAMER_PUBLIC_METHODS = [
  "framer.agent.applyChanges",
  "framer.agent.flattenComponentInstance",
  "framer.agent.makeExternalComponentLocal",
  "framer.agent.queryAnalytics",
  "framer.agent.readComponentControls",
  "framer.agent.readIconSetControls",
  "framer.agent.readIcons",
  "framer.agent.readLayoutTemplateControls",
  "framer.agent.readShaderControls",
  "framer.agent.replaceText",
  "framer.createCodeFile",
  "framer.getCodeFile",
  "framer.getCodeFiles",
] as const;

export type FramerPublicMethod = (typeof REQUIRED_FRAMER_PUBLIC_METHODS)[number];

export interface FramerCompatibilityInput {
  readonly packageVersion: string;
  readonly framerApiVersion: string;
  readonly contextSchemaVersion: number;
  readonly promptSections: readonly string[];
  readonly publicApi: unknown;
}

export interface FramerCompatibilityRecord {
  readonly packageVersion: string;
  readonly framerApiVersion: string;
  readonly contextSchemaVersion: number;
  readonly criticalPromptSections: Readonly<Record<string, boolean>>;
  readonly publicMethods: Readonly<Record<FramerPublicMethod, boolean>>;
  readonly compatible: boolean;
}

const criticalSections = ["Tools", "Updating the Project", "Core Principles", "How Projects Work"] as const;

export function inspectFramerCompatibility(input: FramerCompatibilityInput): FramerCompatibilityRecord {
  const sectionSet = new Set(input.promptSections);
  const criticalPromptSections = Object.fromEntries(criticalSections.map((section) => [section, sectionSet.has(section)]));
  const publicMethods = Object.fromEntries(REQUIRED_FRAMER_PUBLIC_METHODS.map((method) => [method, hasFunction(input.publicApi, method)])) as unknown as Record<FramerPublicMethod, boolean>;
  const compatible = (SUPPORTED_FRAMER_AGENT_VERSIONS as readonly string[]).includes(input.packageVersion)
    && input.contextSchemaVersion === 1
    && Object.values(criticalPromptSections).every(Boolean)
    && Object.values(publicMethods).every(Boolean);
  return Object.freeze({
    packageVersion: input.packageVersion,
    framerApiVersion: input.framerApiVersion,
    contextSchemaVersion: input.contextSchemaVersion,
    criticalPromptSections: Object.freeze(criticalPromptSections),
    publicMethods: Object.freeze(publicMethods),
    compatible,
  });
}

function hasFunction(root: unknown, path: string): boolean {
  let cursor = root;
  for (const part of path.split(".").slice(1)) {
    if (!cursor || (typeof cursor !== "object" && typeof cursor !== "function")) return false;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === "function";
}
