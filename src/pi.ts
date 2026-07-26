import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import {
  DESIGN_QUESTION_DETAILS_TYPE,
  askUserSchema,
  type AskUserInput,
  type DesignQuestionDetails,
  validateAskUserInput,
} from "./contracts.js";

export interface AskUserExtensionOptions {
  readonly createQuestionId?: () => string;
}

export function createAskUserExtension(options: AskUserExtensionOptions = {}): ExtensionFactory {
  const createQuestionId = options.createQuestionId ?? randomUUID;
  return (pi: ExtensionAPI) => {
    // Deliberately session-local: Pi invokes an extension factory for each session.
    const questions = new Map<string, DesignQuestionDetails>();

    pi.registerTool({
      name: "ask_user",
      label: "Ask Designer",
      description:
        "Pause at a meaningful unresolved design decision and ask the designer one focused, user-facing, single-select question with 2–4 concrete outcomes. Never ask about APIs, schemas, node types, files, or implementation mechanics.",
      promptSnippet: "Ask one structured, designer-friendly design question and end this run until it is answered",
      promptGuidelines: [
        "Use ask_user only for materially unresolved design decisions; resolve purely technical choices yourself.",
        "Every ask_user option must describe a visible or user-facing outcome, with at most one recommendation.",
        "Call ask_user as the only tool in its tool batch. Do not infer an answer or continue work after calling it.",
      ],
      parameters: askUserSchema,
      executionMode: "sequential",
      async execute(toolCallId, input: AskUserInput) {
        validateAskUserInput(input);
        const details: DesignQuestionDetails = {
          type: DESIGN_QUESTION_DETAILS_TYPE,
          questionId: createQuestionId(),
          question: input.question.trim(),
          ...(input.whyItMatters ? { whyItMatters: input.whyItMatters.trim() } : {}),
          ...(input.decisionContext ? { decisionContext: input.decisionContext.trim() } : {}),
          ...(input.topic ? { topic: input.topic } : {}),
          options: input.options.map((option) => ({
            id: option.id,
            title: option.title.trim(),
            ...(option.description ? { description: option.description.trim() } : {}),
            ...(option.recommended ? { recommended: true as const } : {}),
          })),
          allowOther: input.allowOther ?? false,
          allowDelegation: input.allowDelegation ?? false,
          toolCallId,
        };
        questions.set(details.questionId, details);
        return {
          content: [
            {
              type: "text" as const,
              text: "Question sent to the designer. End this run now. Do not infer an answer or continue until a later user message provides the persisted decision.",
            },
          ],
          details,
          terminate: true,
        };
      },
    });
  };
}

export function createFramerAgentCoreExtension(options: AskUserExtensionOptions = {}): ExtensionFactory {
  return createAskUserExtension(options);
}
