import { createHash } from "node:crypto";

export const METRIC_UNAVAILABLE = "unavailable" as const;
export type Measured<T> = T | typeof METRIC_UNAVAILABLE;

export interface PromptRunMeasurements {
  readonly modelSteps: Measured<number>;
  readonly toolResultBytes: Measured<number>;
  readonly durationMs: Measured<number>;
  readonly cacheMisses: Measured<number>;
  readonly cachedInputTokens: Measured<number>;
  readonly freshInputTokens: Measured<number>;
}

export interface PromptRunOutcome {
  readonly functional: "passed" | "failed" | "not_reviewed";
  readonly visualReview: "passed" | "failed" | "not_applicable" | "not_reviewed";
  readonly unintendedSideEffects: readonly string[];
}

export interface PromptRunBaseline {
  readonly trajectory: string;
  readonly model: string;
  readonly harnessProfile: string;
  readonly measurements: PromptRunMeasurements;
  readonly outcome: PromptRunOutcome;
}

export interface PromptRunBaselineInput extends Omit<PromptRunBaseline, "measurements"> {
  readonly measurements?: Partial<PromptRunMeasurements>;
}

const measurementKeys = [
  "modelSteps", "toolResultBytes", "durationMs", "cacheMisses", "cachedInputTokens", "freshInputTokens",
] as const;

export function createPromptRunBaseline(input: PromptRunBaselineInput): PromptRunBaseline {
  const measurements = Object.fromEntries(measurementKeys.map((key) => [
    key,
    input.measurements?.[key] ?? METRIC_UNAVAILABLE,
  ])) as unknown as PromptRunMeasurements;
  for (const key of measurementKeys) {
    const value = measurements[key];
    if (value !== METRIC_UNAVAILABLE && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${key} must be a non-negative host measurement or unavailable`);
    }
  }
  return deepFreeze({ ...input, measurements, outcome: { ...input.outcome, unintendedSideEffects: [...input.outcome.unintendedSideEffects] } });
}

export interface PromptTranscriptEntry {
  readonly role: string;
  readonly content: unknown;
}

export interface PromptPrefixAssertion {
  readonly entries: number;
  readonly hash: string;
}

export function createPromptPrefixGuard() {
  let hashes: readonly string[] = [];
  return {
    assert(entries: readonly PromptTranscriptEntry[]): PromptPrefixAssertion {
      const next = entries.map(stableHash);
      if (next.length < hashes.length) throw new Error("Prompt transcript removed earlier entries");
      for (let index = 0; index < hashes.length; index += 1) {
        if (next[index] !== hashes[index]) {
          throw new Error(`Prompt transcript changed or reordered earlier entry ${index}`);
        }
      }
      hashes = Object.freeze([...next]);
      return Object.freeze({ entries: next.length, hash: stableHash(next) });
    },
  };
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
