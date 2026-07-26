export type CanvasEvidenceStatus = "clean" | "issues" | "incomplete";

export interface CanvasDiagnostic {
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly location?: string;
  readonly action?: string;
}

export interface CanvasMutationEvidence {
  readonly status: CanvasEvidenceStatus;
  readonly diagnostics: readonly CanvasDiagnostic[];
  readonly renamedIds: Readonly<Record<string, string>>;
  readonly affected: { readonly ids: readonly string[]; readonly count?: number; readonly scope?: string };
}

const MAX_DIAGNOSTICS = 50;
const MAX_IDS = 100;
const MAX_RENAMES = 100;
const MAX_TEXT_LENGTH = 1000;

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function addDiagnostics(
  target: CanvasDiagnostic[],
  value: unknown,
  fallback: CanvasDiagnostic["severity"],
): void {
  for (const raw of Array.isArray(value) ? value : value == null ? [] : [value]) {
    if (target.length >= MAX_DIAGNOSTICS) return;
    const item = object(raw);
    const message = text(raw) ?? text(item?.message) ?? text(item?.error) ??
      text(item?.description) ?? text(item?.reason);
    if (!message) continue;
    const level = text(item?.severity ?? item?.level ?? item?.type)?.toLowerCase();
    const severity = level === "error" || level === "warning" || level === "info"
      ? level
      : fallback;
    const location = text(item?.location) ?? text(item?.path) ?? text(item?.nodeId) ?? text(item?.id);
    const action = text(item?.action) ?? text(item?.suggestion) ?? text(item?.fix);
    target.push({ severity, message, ...(location ? { location } : {}), ...(action ? { action } : {}) });
  }
}

export function parseCanvasMutationEvidence(value: unknown): CanvasMutationEvidence {
  const root = object(value);
  if (!root) return incompleteEvidence();

  const diagnostics: CanvasDiagnostic[] = [];
  addDiagnostics(diagnostics, root.parseErrors, "error");
  addDiagnostics(diagnostics, root.errors, "error");
  addDiagnostics(diagnostics, root.warnings, "warning");
  addDiagnostics(diagnostics, root.diagnostics, "warning");
  addDiagnostics(diagnostics, root.linterDiagnostics ?? root.lintDiagnostics ?? root.linterIssues, "warning");
  for (const raw of Array.isArray(root.results)
    ? root.results
    : Array.isArray(root.commands) ? root.commands : []) {
    const command = object(raw);
    if (!command) continue;
    addDiagnostics(diagnostics, command.errors ?? command.error, "error");
    addDiagnostics(diagnostics, command.warnings ?? command.warning, "warning");
    addDiagnostics(diagnostics, command.diagnostics, "warning");
  }
  diagnostics.sort((left, right) =>
    left.severity.localeCompare(right.severity) ||
    (left.location ?? "").localeCompare(right.location ?? "") ||
    left.message.localeCompare(right.message));

  const renameSource = object(root.renamedIds) ?? {};
  const renamedIds = Object.fromEntries(Object.entries(renameSource)
    .filter((entry): entry is [string, string] => Boolean(text(entry[0])) && Boolean(text(entry[1])))
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_RENAMES)
    .map(([from, to]) => [from.slice(0, MAX_TEXT_LENGTH), to.trim().slice(0, MAX_TEXT_LENGTH)]));
  const affected = object(root.affected) ?? object(root.summary);
  const rawIds = root.affectedIds ?? root.nodeIds ?? affected?.ids;
  const ids = [...new Set(Array.isArray(rawIds) ? rawIds.map(text).filter((item): item is string => Boolean(item)) : [])]
    .sort()
    .slice(0, MAX_IDS);
  const rawCount = root.affectedCount ?? root.commandCount ?? affected?.count;
  const count = typeof rawCount === "number" && Number.isFinite(rawCount) && rawCount >= 0
    ? rawCount
    : undefined;
  const scope = text(root.scope ?? root.pagePath ?? affected?.scope);
  const explicit = text(root.status)?.toLowerCase();
  const explicitlyIncomplete = explicit === "partial" || explicit === "incomplete" ||
    explicit === "failed" || root.complete === false;
  const explicitlyComplete = ["success", "succeeded", "complete", "completed", "clean", "ok"].includes(explicit ?? "") ||
    root.complete === true;
  const hasKnownEvidence = explicitlyComplete || explicitlyIncomplete || diagnostics.length > 0 ||
    "results" in root || "commands" in root || "affectedIds" in root || "renamedIds" in root ||
    "affected" in root || "summary" in root;
  const status: CanvasEvidenceStatus = explicitlyIncomplete || !hasKnownEvidence
    ? "incomplete"
    : diagnostics.length ? "issues" : "clean";

  return {
    status,
    diagnostics,
    renamedIds,
    affected: { ids, ...(count !== undefined ? { count } : {}), ...(scope ? { scope } : {}) },
  };
}

export function serializeCanvasMutationEvidence(evidence: CanvasMutationEvidence): string {
  return JSON.stringify(evidence);
}

function incompleteEvidence(): CanvasMutationEvidence {
  return { status: "incomplete", diagnostics: [], renamedIds: {}, affected: { ids: [] } };
}
