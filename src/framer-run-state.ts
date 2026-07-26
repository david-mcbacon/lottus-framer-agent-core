import type { CanvasDiagnostic, CanvasEvidenceStatus } from "./canvas-evidence.js";

export type CodeVerificationStatus = "clean" | "issues" | "incomplete";

export interface CodeFileRunState {
  readonly mutationVersion: number;
  readonly verificationVersion: number;
  readonly verificationStatus: CodeVerificationStatus;
  readonly diagnostics: readonly unknown[];
  readonly exportDiagnostic?: string;
  readonly contentHash?: string;
}

export interface FramerRunState {
  canvasMutationVersion: number;
  canvasEvidenceVersion: number;
  canvasEvidenceStatus: CanvasEvidenceStatus;
  canvasDiagnostics: CanvasDiagnostic[];
  codeFiles: Map<string, CodeFileRunState>;
  published: boolean;
}

export function createFramerRunState(): FramerRunState {
  return {
    canvasMutationVersion: 0,
    canvasEvidenceVersion: 0,
    canvasEvidenceStatus: "incomplete",
    canvasDiagnostics: [],
    codeFiles: new Map(),
    published: false,
  };
}

export function recordCodeMutation(state: FramerRunState, name: string): CodeFileRunState {
  const previous = state.codeFiles.get(name);
  const next: CodeFileRunState = {
    mutationVersion: (previous?.mutationVersion ?? 0) + 1,
    verificationVersion: previous?.verificationVersion ?? 0,
    verificationStatus: "incomplete",
    diagnostics: [],
  };
  state.codeFiles.set(name, next);
  return next;
}

export function recordCodeVerification(
  state: FramerRunState,
  name: string,
  evidence: { readonly complete: boolean; readonly diagnostics: readonly unknown[]; readonly exportDiagnostic?: string; readonly contentHash?: string },
): CodeFileRunState {
  const previous = state.codeFiles.get(name) ?? {
    mutationVersion: 0,
    verificationVersion: 0,
    verificationStatus: "incomplete" as const,
    diagnostics: [],
  };
  const issues = evidence.diagnostics.length > 0 || Boolean(evidence.exportDiagnostic);
  const next: CodeFileRunState = {
    mutationVersion: previous.mutationVersion,
    verificationVersion: evidence.complete ? previous.mutationVersion : previous.verificationVersion,
    verificationStatus: evidence.complete ? (issues ? "issues" : "clean") : "incomplete",
    diagnostics: [...evidence.diagnostics],
    ...(evidence.exportDiagnostic ? { exportDiagnostic: evidence.exportDiagnostic } : {}),
    ...(evidence.contentHash ? { contentHash: evidence.contentHash } : {}),
  };
  state.codeFiles.set(name, next);
  return next;
}
