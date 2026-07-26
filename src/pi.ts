import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { createFramerCanvasExtension, type FramerExecutionAdapter } from "./framer-canvas.js";
import { createFramerCodeFilesExtension, type FramerScratchFileAdapter } from "./framer-code-files.js";
import { createFramerCompletionExtension } from "./framer-completion.js";
import { createFramerOperationsExtension } from "./framer-operations.js";
import { createFramerRunState, type FramerRunState } from "./framer-run-state.js";
import { createFramerVisualExtension, type FramerVisualAdapter } from "./framer-visual.js";
import { createFramerPatternExtension, type FramerPatternAdapter } from "./framer-patterns.js";
import {
  DESIGN_QUESTION_DETAILS_TYPE,
  askUserSchema,
  type AskUserInput,
  type DesignQuestionDetails,
  validateAskUserInput,
} from "./contracts.js";
import { createPromptRunSteeringExtension, type FramerSteeringProfile, type LiveFramerContextProvider } from "./prompt-run.js";

export interface AskUserExtensionOptions {
  readonly createQuestionId?: () => string;
}

export function createAskUserExtension(options: AskUserExtensionOptions = {}): ExtensionFactory {
  const createQuestionId = options.createQuestionId ?? randomUUID;
  return (pi: ExtensionAPI) => {
    // Deliberately session-local: Pi invokes this registration for each session.
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

export interface FramerAgentCoreExtensionOptions extends AskUserExtensionOptions {
  readonly executionAdapter?: FramerExecutionAdapter;
  readonly scratchAdapter?: FramerScratchFileAdapter;
  readonly visualAdapter?: FramerVisualAdapter;
  readonly patternAdapter?: FramerPatternAdapter;
  readonly onSessionStateCreated?: (state: FramerRunState) => void;
  readonly capabilityProfile?: FramerModelCapabilityProfile;
  readonly liveContextProvider?: LiveFramerContextProvider;
}

export interface FramerModelCapabilityProfile extends FramerSteeringProfile {
  readonly structuredDesignQuestions?: boolean;
}

export function createFramerAgentCoreExtension(
  options: FramerAgentCoreExtensionOptions = {},
): ExtensionFactory {
  const askUser = options.capabilityProfile?.structuredDesignQuestions === false
    ? undefined
    : createAskUserExtension(options);
  return (pi) => {
    if (options.liveContextProvider) createPromptRunSteeringExtension({
      liveContextProvider: options.liveContextProvider,
      ...(options.capabilityProfile ? { profile: options.capabilityProfile } : {}),
    })(pi);
    askUser?.(pi);
    if (options.patternAdapter) createFramerPatternExtension(options.patternAdapter)(pi);
    if (!options.executionAdapter) return;
    const state = createFramerRunState();
    options.onSessionStateCreated?.(state);
    createFramerCanvasExtension(options.executionAdapter, { state })(pi);
    createFramerOperationsExtension(options.executionAdapter, state)(pi);
    if (options.visualAdapter) createFramerVisualExtension(options.visualAdapter, state)(pi);
    if (options.scratchAdapter) {
      createFramerCodeFilesExtension({
        executionAdapter: options.executionAdapter,
        scratchAdapter: options.scratchAdapter,
        state,
      })(pi);
    }
    createFramerCompletionExtension(state)(pi);
  };
}
