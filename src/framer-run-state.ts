import type { CanvasDiagnostic, CanvasEvidenceStatus } from "./canvas-evidence.js";
import type { FramerReviewStatus } from "./contracts.js";

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
  genericMutationVersion: number;
  genericEvidenceVersion: number;
  genericVerificationAction?: string;
  published: boolean;
  publicationTarget?: "branch" | "staging" | "production";
  publicationPreviewHash?: string;
}

export function createFramerRunState(): FramerRunState {
  return {
    canvasMutationVersion: 0,
    canvasEvidenceVersion: 0,
    canvasEvidenceStatus: "incomplete",
    canvasDiagnostics: [],
    codeFiles: new Map(),
    genericMutationVersion: 0,
    genericEvidenceVersion: 0,
    published: false,
  };
}

export function derivedReviewStatus(state: FramerRunState): FramerReviewStatus {
  const codeStates = [...state.codeFiles.values()];
  const mutated = state.canvasMutationVersion > 0
    || codeStates.some((item) => item.mutationVersion > 0)
    || state.genericMutationVersion > 0;
  if (!mutated) return "not_needed";

  const issues = (
    state.canvasMutationVersion > 0
    && (state.canvasEvidenceStatus === "issues" || state.canvasDiagnostics.length > 0)
  ) || codeStates.some(
    (item) => item.mutationVersion > 0 && item.verificationStatus === "issues",
  );
  return issues ? "issues_remain" : "clean";
}

export function incompleteReviewReason(state: FramerRunState): string | undefined {
  if (
    state.canvasMutationVersion > state.canvasEvidenceVersion
    || (state.canvasMutationVersion > 0 && state.canvasEvidenceStatus === "incomplete")
  ) {
    return "obtain complete diagnostics for the latest canvas mutation with framer_apply_changes";
  }

  if (state.genericMutationVersion > state.genericEvidenceVersion) {
    return state.genericVerificationAction
      ?? "verify or correct the latest generic Framer mutation with a typed Core operation";
  }

  const pending = [...state.codeFiles.entries()]
    .filter(([, item]) =>
      item.mutationVersion > item.verificationVersion
      || (item.mutationVersion > 0 && item.verificationStatus === "incomplete"))
    .map(([name]) => name);
  return pending.length > 0
    ? `verify the latest code-file mutation for ${pending.join(", ")} with framer_check_code_file`
    : undefined;
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
