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
  visualRequirement: "geometry" | "screenshot";
  geometryEvidenceVersion: number;
  screenshotEvidenceVersion: number;
  codeFiles: Map<string, CodeFileRunState>;
  genericMutationVersion: number;
  genericEvidenceVersion: number;
  genericVerificationAction?: string;
  typedVerification?: TypedVerificationDescriptor;
  typedVerificationAction?: string;
  published: boolean;
  publicationTarget?: "branch" | "staging" | "production";
  publicationPreviewHash?: string;
}

export type TypedVerificationDescriptor =
  | { readonly kind: "replace-text"; readonly mutationVersion: number; readonly id: string; readonly pagePath?: string }
  | { readonly kind: "flatten-component"; readonly mutationVersion: number; readonly replacementId: string; readonly pagePath?: string }
  | { readonly kind: "make-component-local"; readonly mutationVersion: number; readonly id: string; readonly componentId: string; readonly previousComponentId?: string; readonly pagePath?: string; readonly replaceAll: boolean };

type TypedVerificationInput =
  | Omit<Extract<TypedVerificationDescriptor, { kind: "replace-text" }>, "mutationVersion">
  | Omit<Extract<TypedVerificationDescriptor, { kind: "flatten-component" }>, "mutationVersion">
  | Omit<Extract<TypedVerificationDescriptor, { kind: "make-component-local" }>, "mutationVersion">;

export function recordGenericMutation(
  state: FramerRunState,
  evidence: { readonly verified: boolean; readonly pendingAction?: string },
): number {
  state.genericMutationVersion += 1;
  if (evidence.verified) {
    state.genericEvidenceVersion = state.genericMutationVersion;
    delete state.genericVerificationAction;
  } else {
    state.genericVerificationAction = evidence.pendingAction
      ?? "verify or correct the latest generic Framer mutation with a typed Core operation";
  }
  return state.genericMutationVersion;
}

export function recordTypedMutation(
  state: FramerRunState,
  evidence: { readonly verified: boolean; readonly descriptor?: TypedVerificationInput; readonly pendingAction?: string },
): number {
  state.genericMutationVersion += 1;
  const version = state.genericMutationVersion;
  if (evidence.verified) {
    state.genericEvidenceVersion = version;
    if (state.typedVerification && evidence.descriptor && sameTypedTarget(state.typedVerification, evidence.descriptor)) {
      delete state.typedVerification;
      delete state.typedVerificationAction;
    }
    if (!state.typedVerification) delete state.genericVerificationAction;
  } else if (evidence.descriptor) {
    state.typedVerification = { ...evidence.descriptor, mutationVersion: version } as TypedVerificationDescriptor;
    state.typedVerificationAction = evidence.pendingAction ?? "verify the latest typed Framer mutation with framer_verify_typed_operation";
  }
  return version;
}

function sameTypedTarget(left: TypedVerificationDescriptor, right: TypedVerificationInput): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "flatten-component" && right.kind === "flatten-component") return left.replacementId === right.replacementId;
  if (left.kind === "replace-text" && right.kind === "replace-text") return left.id === right.id;
  return left.kind === "make-component-local" && right.kind === "make-component-local" && left.id === right.id;
}

export function createFramerRunState(): FramerRunState {
  return {
    canvasMutationVersion: 0,
    canvasEvidenceVersion: 0,
    canvasEvidenceStatus: "incomplete",
    canvasDiagnostics: [],
    visualRequirement: "geometry",
    geometryEvidenceVersion: 0,
    screenshotEvidenceVersion: 0,
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

  if (state.canvasMutationVersion > 0 && state.canvasEvidenceStatus !== "issues") {
    if (state.visualRequirement === "screenshot" && state.screenshotEvidenceVersion < state.canvasMutationVersion) {
      return "capture a project screenshot for the latest high-risk canvas mutation with framer_capture_screenshot";
    }
    if (state.visualRequirement === "geometry" && state.geometryEvidenceVersion < state.canvasMutationVersion) {
      return "obtain bounded geometry diagnostics for the latest canvas mutation with framer_check_geometry";
    }
  }

  if (state.typedVerification) {
    return state.typedVerificationAction
      ?? `verify typed ${state.typedVerification.kind} evidence with framer_verify_typed_operation`;
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
