import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";

export const DESIGN_QUESTION_DETAILS_TYPE = "lottus_design_question" as const;
export const FRAMER_COMPLETION_DETAILS_TYPE = "lottus_framer_completion" as const;

export const finishFramerWorkSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1, maxLength: 1000 }),
    visibleChanges: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { maxItems: 20 }),
    unresolvedIssues: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { maxItems: 20 }),
  },
  { additionalProperties: false },
);

export type FinishFramerWorkInput = Static<typeof finishFramerWorkSchema>;
export type FramerReviewStatus = "not_needed" | "clean" | "issues_remain";

export interface FramerCompletionDetails {
  readonly type: typeof FRAMER_COMPLETION_DETAILS_TYPE;
  readonly summary: string;
  readonly visibleChanges: readonly string[];
  readonly reviewStatus: FramerReviewStatus;
  readonly unresolvedIssues: readonly string[];
  readonly published: boolean;
  readonly publicationTarget?: "branch" | "staging" | "production";
}

export function isFramerCompletionDetails(value: unknown): value is FramerCompletionDetails {
  return isRecord(value)
    && value.type === FRAMER_COMPLETION_DETAILS_TYPE
    && typeof value.summary === "string"
    && isStringArray(value.visibleChanges)
    && (value.reviewStatus === "not_needed" || value.reviewStatus === "clean" || value.reviewStatus === "issues_remain")
    && isStringArray(value.unresolvedIssues)
    && typeof value.published === "boolean"
    && (value.publicationTarget === undefined || value.publicationTarget === "branch" || value.publicationTarget === "staging" || value.publicationTarget === "production");
}

export const designQuestionTopics = [
  "purpose",
  "audience",
  "content",
  "hierarchy",
  "layout",
  "visual-style",
  "typography",
  "color",
  "imagery",
  "motion",
  "responsive",
  "accessibility",
  "design-system",
  "scope",
] as const;

export const askUserSchema = Type.Object(
  {
    question: Type.String({ minLength: 1, maxLength: 500 }),
    whyItMatters: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
    decisionContext: Type.Optional(Type.String({ minLength: 1, maxLength: 1000 })),
    topic: Type.Optional(StringEnum(designQuestionTopics)),
    options: Type.Array(
      Type.Object(
        {
          id: Type.String({ pattern: "^[A-Za-z0-9_-]{1,64}$" }),
          title: Type.String({ minLength: 1, maxLength: 120 }),
          description: Type.Optional(Type.String({ minLength: 1, maxLength: 240 })),
          recommended: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
      { minItems: 2, maxItems: 4 },
    ),
    allowOther: Type.Optional(Type.Boolean()),
    allowDelegation: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export type AskUserInput = Static<typeof askUserSchema>;
export type DesignQuestionTopic = (typeof designQuestionTopics)[number];

export interface DesignQuestionOption {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly recommended?: true;
}

export interface DesignQuestionDetails {
  readonly type: typeof DESIGN_QUESTION_DETAILS_TYPE;
  readonly questionId: string;
  readonly question: string;
  readonly whyItMatters?: string;
  readonly decisionContext?: string;
  readonly topic?: DesignQuestionTopic;
  readonly options: readonly DesignQuestionOption[];
  readonly allowOther: boolean;
  readonly allowDelegation: boolean;
  readonly toolCallId: string;
}

export function validateAskUserInput(input: AskUserInput): void {
  if (!input.question.trim()) {
    throw new Error("ask_user question must not be blank");
  }
  const ids = new Set<string>();
  let recommendations = 0;
  for (const option of input.options) {
    if (!option.title.trim()) {
      throw new Error(`ask_user option title must not be blank: ${option.id}`);
    }
    if (ids.has(option.id)) {
      throw new Error(`ask_user option id must be unique: ${option.id}`);
    }
    ids.add(option.id);
    if (option.recommended) recommendations += 1;
  }
  if (recommendations > 1) {
    throw new Error("ask_user accepts at most one recommended option");
  }
}

export function isDesignQuestionDetails(value: unknown): value is DesignQuestionDetails {
  if (!isRecord(value) || value.type !== DESIGN_QUESTION_DETAILS_TYPE) return false;
  if (
    typeof value.questionId !== "string" ||
    typeof value.question !== "string" ||
    typeof value.toolCallId !== "string" ||
    typeof value.allowOther !== "boolean" ||
    typeof value.allowDelegation !== "boolean" ||
    !Array.isArray(value.options) ||
    value.options.length < 2 ||
    value.options.length > 4
  ) {
    return false;
  }
  return value.options.every(
    (option) =>
      isRecord(option) &&
      typeof option.id === "string" &&
      typeof option.title === "string" &&
      (option.description === undefined || typeof option.description === "string") &&
      (option.recommended === undefined || option.recommended === true),
  );
}

export type DesignQuestionAnswer =
  | { readonly kind: "option"; readonly option: DesignQuestionOption }
  | { readonly kind: "other"; readonly text: string }
  | { readonly kind: "delegation" };

const DESIGN_QUESTION_ANSWER_HEADER = "Design Question answer";
const DESIGN_QUESTION_ANSWER_ID_PREFIX = "Question ID:";

/** Human-facing label for an answer, used by transcript UIs. */
export function designQuestionAnswerDisplay(answer: DesignQuestionAnswer): string {
  if (answer.kind === "option") return answer.option.title;
  if (answer.kind === "other") return answer.text;
  return "Use your judgment";
}

export function formatDesignQuestionAnswer(
  question: DesignQuestionDetails,
  answer: DesignQuestionAnswer,
): string {
  return [
    DESIGN_QUESTION_ANSWER_HEADER,
    `${DESIGN_QUESTION_ANSWER_ID_PREFIX} ${question.questionId}`,
    designQuestionAnswerBody(question, answer),
  ].join("\n");
}

function designQuestionAnswerBody(
  question: DesignQuestionDetails,
  answer: DesignQuestionAnswer,
): string {
  if (answer.kind === "option") {
    if (!question.options.some((candidate) => candidate.id === answer.option.id)) {
      throw new Error(`Unknown Design Question option: ${answer.option.id}`);
    }
    return `Selected option: ${answer.option.id} — ${answer.option.title}`;
  }
  if (answer.kind === "other") {
    const text = answer.text.trim();
    if (!text) throw new Error("Design Question answer text must not be blank");
    if (!question.allowOther) {
      throw new Error("This Design Question does not accept a free-form answer");
    }
    return `Designer-provided answer: ${text}`;
  }
  if (!question.allowDelegation) {
    throw new Error("This Design Question does not accept delegation");
  }
  return "The designer delegated this decision: use your judgment and choose the strongest outcome for the stated goals.";
}

/**
 * Recognizes the answer messages produced by {@link formatDesignQuestionAnswer}
 * so transcript UIs can attribute them back to their question instead of
 * rendering the raw machine text.
 */
export function parseDesignQuestionAnswer(
  text: string,
): { readonly questionId: string; readonly display: string } | undefined {
  const lines = text.trim().split("\n");
  if (lines[0]?.trim() !== DESIGN_QUESTION_ANSWER_HEADER) return undefined;
  const idLine = lines[1]?.trim() ?? "";
  if (!idLine.startsWith(DESIGN_QUESTION_ANSWER_ID_PREFIX)) return undefined;
  const questionId = idLine.slice(DESIGN_QUESTION_ANSWER_ID_PREFIX.length).trim();
  if (!questionId) return undefined;
  const body = lines.slice(2).join("\n").trim();
  return { questionId, display: designAnswerDisplayFromBody(body) };
}

function designAnswerDisplayFromBody(body: string): string {
  const selected = /^Selected option: [^\s]+ — (.+)$/.exec(body);
  if (selected?.[1]) return selected[1];
  const other = /^Designer-provided answer: ([\s\S]+)$/.exec(body);
  if (other?.[1]) return other[1];
  if (body.startsWith("The designer delegated this decision")) return "Use your judgment";
  return body;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
