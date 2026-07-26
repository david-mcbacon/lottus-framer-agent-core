import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";

export interface CapturedPiTool {
  readonly name: string;
  readonly executionMode?: string;
  readonly parameters: unknown;
  readonly execute: (
    toolCallId: string,
    input: never,
    signal?: AbortSignal,
    update?: unknown,
    context?: unknown,
  ) => Promise<unknown>;
}

export function captureExtensionTools(extension: ExtensionFactory): ReadonlyMap<string, CapturedPiTool> {
  const tools = new Map<string, CapturedPiTool>();
  extension({
    registerTool(definition: CapturedPiTool) {
      tools.set(definition.name, definition);
    },
  } as unknown as ExtensionAPI);
  return tools;
}

export function requireCapturedTool(
  tools: ReadonlyMap<string, CapturedPiTool>,
  name: string,
): CapturedPiTool {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Extension did not register tool: ${name}`);
  return tool;
}
