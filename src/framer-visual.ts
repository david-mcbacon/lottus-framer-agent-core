import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { FramerRunState } from "./framer-run-state.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DIAGNOSTICS = 50;

export interface FramerImage { readonly data: Uint8Array; readonly mimeType: "image/png" | "image/jpeg" | "image/webp"; }
export interface GeometryDiagnostic { readonly kind: "overlap" | "clipping" | "out-of-bounds" | "inconsistent-dimensions" | "spacing"; readonly location: string; readonly action: string; }
export interface GeometryResult { readonly diagnostics: readonly GeometryDiagnostic[]; readonly complete: boolean; }
export interface StockImageCandidate { readonly url: string; readonly title?: string; readonly source?: string; }
export interface FramerVisualAdapter {
  captureProject(input: { target: string; maxWidth: number; maxHeight: number }, options: { signal?: AbortSignal; workspaceRoot: string }): Promise<FramerImage>;
  viewExternal(input: { url: string; maxWidth: number; maxHeight: number }, options: { signal?: AbortSignal; workspaceRoot: string }): Promise<FramerImage>;
  inspectGeometry(input: { target: string; maxNodes: number }, options: { signal?: AbortSignal; workspaceRoot: string }): Promise<GeometryResult>;
  searchStock(input: { query: string; limit: number }, options: { signal?: AbortSignal; workspaceRoot: string }): Promise<readonly StockImageCandidate[]>;
}

function checkedImage(image: FramerImage): { type: "image"; data: string; mimeType: string } {
  if (!image.data.byteLength || image.data.byteLength > MAX_IMAGE_BYTES) throw new Error("Visual output is empty or exceeds the 10 MiB limit.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)) throw new Error("Visual output has an unsupported MIME type.");
  return { type: "image", data: Buffer.from(image.data).toString("base64"), mimeType: image.mimeType };
}

export function createFramerVisualExtension(adapter: FramerVisualAdapter, state: FramerRunState): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    const imageParams = { target: Type.String({ minLength: 1, maxLength: 500 }), maxWidth: Type.Integer({ minimum: 64, maximum: 4096 }), maxHeight: Type.Integer({ minimum: 64, maximum: 4096 }) };
    pi.registerTool({ name: "framer_capture_screenshot", label: "Capture Framer Screenshot", description: "Capture bounded pixels from the current project and record visual evidence.", parameters: Type.Object(imageParams, { additionalProperties: false }), executionMode: "sequential", async execute(_id, input, signal, _update, ctx) {
      const image = checkedImage(await adapter.captureProject(input, { ...(signal ? { signal } : {}), workspaceRoot: ctx?.cwd ?? process.cwd() }));
      state.screenshotEvidenceVersion = state.canvasMutationVersion;
      return { content: [image], details: { target: input.target, mutationVersion: state.canvasMutationVersion, bytes: Buffer.byteLength(image.data, "base64") } };
    }});
    pi.registerTool({ name: "framer_view_image", label: "View Image", description: "View a bounded external reference or candidate image. This never verifies a project mutation.", parameters: Type.Object({ url: Type.String({ minLength: 1, maxLength: 2048 }), maxWidth: imageParams.maxWidth, maxHeight: imageParams.maxHeight }, { additionalProperties: false }), async execute(_id, input, signal, _update, ctx) {
      const image = checkedImage(await adapter.viewExternal(input, { ...(signal ? { signal } : {}), workspaceRoot: ctx?.cwd ?? process.cwd() }));
      return { content: [image], details: { url: input.url, projectEvidence: false, bytes: Buffer.byteLength(image.data, "base64") } };
    }});
    pi.registerTool({ name: "framer_check_geometry", label: "Check Framer Geometry", description: "Inspect bounded deterministic layout diagnostics: overlap, clipping, bounds, repeated dimensions, and spacing.", parameters: Type.Object({ target: Type.String({ minLength: 1, maxLength: 500 }), maxNodes: Type.Integer({ minimum: 1, maximum: 500 }) }, { additionalProperties: false }), executionMode: "sequential", async execute(_id, input, signal, _update, ctx) {
      const result = await adapter.inspectGeometry(input, { ...(signal ? { signal } : {}), workspaceRoot: ctx?.cwd ?? process.cwd() });
      if (!result.complete) throw new Error("Geometry inspection was incomplete; visual evidence remains pending.");
      const diagnostics = result.diagnostics.slice(0, MAX_DIAGNOSTICS);
      state.geometryEvidenceVersion = state.canvasMutationVersion;
      return { content: [{ type: "text" as const, text: JSON.stringify({ target: input.target, status: diagnostics.length ? "issues" : "clean", diagnostics }) }], details: { target: input.target, mutationVersion: state.canvasMutationVersion, diagnostics } };
    }});
    pi.registerTool({ name: "framer_search_stock_images", label: "Search Framer Stock Images", description: "Search trusted Framer stock candidates while preserving exact asset URLs.", parameters: Type.Object({ query: Type.String({ minLength: 2, maxLength: 200 }), limit: Type.Integer({ minimum: 1, maximum: 20 }) }, { additionalProperties: false }), async execute(_id, input, signal, _update, ctx) {
      const candidates = (await adapter.searchStock(input, { ...(signal ? { signal } : {}), workspaceRoot: ctx?.cwd ?? process.cwd() })).slice(0, input.limit);
      if (candidates.some((item) => !/^https:\/\//u.test(item.url))) throw new Error("Stock search returned an untrusted candidate URL.");
      return { content: [{ type: "text" as const, text: JSON.stringify({ candidates }) }], details: { candidates } };
    }});
  };
}
