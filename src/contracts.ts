import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";

export const DESIGN_QUESTION_DETAILS_TYPE = "lottus_design_question" as const;

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

export function formatDesignQuestionAnswer(
  question: DesignQuestionDetails,
  option: DesignQuestionOption,
): string {
  if (!question.options.some((candidate) => candidate.id === option.id)) {
    throw new Error(`Unknown Design Question option: ${option.id}`);
  }
  return [
    "Design Question answer",
    `Question ID: ${question.questionId}`,
    `Selected option: ${option.id} — ${option.title}`,
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
