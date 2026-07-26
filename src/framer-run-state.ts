import type { CanvasDiagnostic, CanvasEvidenceStatus } from "./canvas-evidence.js";

export interface FramerRunState {
  canvasMutationVersion: number;
  canvasEvidenceVersion: number;
  canvasEvidenceStatus: CanvasEvidenceStatus;
  canvasDiagnostics: CanvasDiagnostic[];
  published: boolean;
}

export function createFramerRunState(): FramerRunState {
  return {
    canvasMutationVersion: 0,
    canvasEvidenceVersion: 0,
    canvasEvidenceStatus: "incomplete",
    canvasDiagnostics: [],
    published: false,
  };
}
